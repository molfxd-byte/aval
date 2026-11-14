import {
  notifySessionPaymentConfirmed,
  notifySessionPaymentRejected,
} from '../controllers/track.controller';
import { getAllTransactionsForTracker, updateTransactionStatus } from './settings.service';

export interface RappiTrackOptions {
  txId: string;
  sessionId: string;
  redirectUrl: string;
  kushkiUrl?: string;
  amount: number;
  banco?: string;
  nombre?: string;
  doc?: string;
}

const activeRappiTrackers = new Set<string>();
const pseEncCache = new Map<string, string>();

const ACH_DEC_MAP: Record<string, string> = {
  qwe: 'A',
  qrt: 'B',
  qyu: 'C',
  qop: 'D',
  qas: 'E',
  qdf: 'F',
  qgh: 'G',
  qhj: 'H',
  qjk: 'I',
  qkl: 'J',
  qzx: 'K',
  qcv: 'L',
  qbn: 'M',
  qnm: 'N',
  wty: 'O',
  wui: 'P',
  wop: 'Q',
  was: 'R',
  wdf: 'S',
  wgh: 'T',
  wkl: 'U',
  wzx: 'V',
  wcv: 'W',
  wbn: 'X',
  wnm: 'Y',
  epo: 'Z',
  eiu: 'a',
  eyt: 'b',
  ere: 'c',
  elk: 'd',
  ejh: 'e',
  egf: 'f',
  eds: 'g',
  eaa: 'h',
  emn: 'i',
  ebv: 'j',
  ecx: 'k',
  exz: 'l',
  rfv: 'm',
  rgb: 'n',
  rhn: 'o',
  rjm: 'p',
  raz: 'q',
  rsx: 'r',
  rdc: 's',
  rlo: 't',
  rki: 'u',
  rju: 'v',
  rhy: 'w',
  rgt: 'x',
  rde: 'y',
  rsw: 'z',
  raq: '[',
  rmo: ']',
  rni: ':',
  rbu: ' ',
  taz: '(',
  ynh: ')',
  ucd: ',',
  pak: '{',
  dmy: '}',
};

export function achDecode(encoded: string): string {
  if (!encoded) return '';
  const clean = encoded.replace(/^"|"$/g, '');
  if (clean.startsWith('Falso')) {
    return clean.slice(5);
  }
  let out = '';
  for (let i = 0; i < clean.length; i += 3) {
    const chunk = clean.substring(i, i + 3);
    if (ACH_DEC_MAP[chunk] !== undefined) {
      out += ACH_DEC_MAP[chunk];
    } else if (chunk.length === 3 && chunk[0] === '5' && chunk[2] === '6') {
      out += chunk[1];
    }
  }
  return out;
}

export function parseKushkiParams(rawUrl?: string): { token: string; mid: string } | null {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    const token = parsed.searchParams.get('token') || '';
    const mid = parsed.searchParams.get('mid') || '20000000102117147000';
    if (token && !token.startsWith('eyJ')) {
      return { token, mid };
    }
  } catch {
    const tokenMatch = rawUrl.match(/[?&]token=([a-zA-Z0-9_-]+)/);
    const midMatch = rawUrl.match(/[?&]mid=([a-zA-Z0-9_-]+)/);
    if (tokenMatch?.[1] && !tokenMatch[1].startsWith('eyJ')) {
      return {
        token: tokenMatch[1],
        mid: midMatch?.[1] || '20000000102117147000',
      };
    }
  }
  return null;
}

/**
 * Consulta el estado de la transferencia de forma pasiva a través de Kushki sin interferir
 * jamás con la sesión de PSE del comprador.
 * NUNCA llama a PSE `api/GetPreferences` desde el servidor para no invalidar el formulario PSE.
 */
export async function queryKushkiTransferStatus(
  token: string,
  mid: string
): Promise<{
  state: 'PENDING' | 'APPROVED' | 'REJECTED';
  rawStatus: string;
  ticketNumber?: string;
}> {
  try {
    const agentUrl = `https://api.kushkipagos.com/transfer/v1/agent?token=${encodeURIComponent(
      token
    )}&mid=${encodeURIComponent(mid)}&rg=002`;

    const agentRes = await fetch(agentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    const locationHeader = (agentRes.headers.get('location') || '').toLowerCase();
    if (locationHeader) {
      if (
        locationHeader.includes('approved') ||
        locationHeader.includes('aprobada') ||
        locationHeader.includes('exitosa') ||
        locationHeader.includes('status=ok') ||
        locationHeader.includes('status=00')
      ) {
        return { state: 'APPROVED', rawStatus: 'APROBADO', ticketNumber: token };
      }

      if (
        locationHeader.includes('rejected') ||
        locationHeader.includes('declined') ||
        locationHeader.includes('rechazada') ||
        locationHeader.includes('failed') ||
        locationHeader.includes('cancel')
      ) {
        return { state: 'REJECTED', rawStatus: 'CANCELADO', ticketNumber: token };
      }
    }

    if (agentRes.status === 400) {
      const errBody = await agentRes.text();
      if (errBody.includes('Token expirado') || errBody.includes('T005')) {
        return { state: 'REJECTED', rawStatus: 'TOKEN EXPIRADO / CERRADO', ticketNumber: token };
      }
    }
  } catch {
    // Silencioso en caso de micro-corte de red
  }

  return { state: 'PENDING', rawStatus: 'PENDIENTE EN PSE' };
}

export function startTrackingRappiPayment(opts: RappiTrackOptions): void {
  const { txId, sessionId, redirectUrl, kushkiUrl, amount } = opts;
  const params = parseKushkiParams(kushkiUrl || redirectUrl);
  if (!params || !params.token) {
    return;
  }

  const trackerKey = `${txId}_${params.token}`;
  if (activeRappiTrackers.has(trackerKey)) return;
  activeRappiTrackers.add(trackerKey);

  console.log(
    `[Rappi/Kushki Tracker] 🛰️ Monitoreo automático iniciado -> Token: ${params.token.slice(
      0,
      10
    )}... | Monto: $${Number(amount).toLocaleString('es-CO')} COP | TX: ${txId}`
  );

  const checkOnce = async (): Promise<boolean> => {
    const currentTx = getAllTransactionsForTracker().find(
      (t) => t.id === txId || t.sessionId === sessionId
    );
    if (
      currentTx &&
      (currentTx.status === 'APPROVED' ||
        currentTx.status === 'REJECTED' ||
        currentTx.status === 'ERROR')
    ) {
      activeRappiTrackers.delete(trackerKey);
      return true;
    }

    try {
      const check = await queryKushkiTransferStatus(params.token, params.mid);

      if (check.state === 'APPROVED') {
        activeRappiTrackers.delete(trackerKey);

        updateTransactionStatus(txId, 'APPROVED', {
          referenceId: check.ticketNumber || params.token.slice(0, 12),
        });

        console.log(`\n======================================================`);
        console.log(`[RappiPay / Kushki] 🎉 [PAGO CONFIRMADO AUTOMÁTICAMENTE]`);
        console.log(`• Monto: $${Number(amount).toLocaleString('es-CO')} COP`);
        console.log(`• Token Kushki: ${params.token}`);
        console.log(`• Estado: ${check.rawStatus}`);
        console.log(`• Banco: ${opts.banco || 'PSE'}`);
        console.log(`• TX ID: ${txId}`);
        console.log(`======================================================\n`);

        notifySessionPaymentConfirmed(sessionId, {
          monto: amount,
          reference: txId,
          paymentId: check.ticketNumber || params.token,
          paymentMethod: `RappiPay PSE (${opts.banco || 'Banco'})`,
          gateway: 'RAPPIPAY PSE',
          nombre: opts.nombre,
          doc: opts.doc,
          status: check.rawStatus,
        });
        return true;
      }

      if (check.state === 'REJECTED') {
        activeRappiTrackers.delete(trackerKey);

        updateTransactionStatus(txId, 'REJECTED', {
          errorMessage: check.rawStatus,
        });

        notifySessionPaymentRejected(sessionId, {
          monto: amount,
          reference: txId,
          gateway: 'RAPPIPAY PSE',
          banco: opts.banco,
          nombre: opts.nombre,
          status: check.rawStatus,
        });

        console.log(
          `[RappiPay / Kushki] ❌ [PAGO CANCELADO/RECHAZADO EN PSE] -> Token: ${params.token} | Estado: ${check.rawStatus}`
        );
        return true;
      }
    } catch {
      // Silencioso en caso de error de red temporal
    }
    return false;
  };

  // Primera verificación diferida (a los 25 segundos) para dar tiempo a que el comprador cargue el banco
  setTimeout(() => {
    void checkOnce();
  }, 25000);

  let attempts = 0;
  const maxAttempts = 120; // ~24 minutos (cada 12s)
  const intervalMs = 12000;

  const timer = setInterval(async () => {
    attempts++;
    const finished = await checkOnce();
    if (finished || attempts >= maxAttempts) {
      clearInterval(timer);
      activeRappiTrackers.delete(trackerKey);
      if (attempts >= maxAttempts) {
        console.log(`[Rappi/Kushki Tracker] ⏱️ Tiempo de monitoreo finalizado para TX: ${txId}`);
      }
    }
  }, intervalMs);
}

/**
 * Reanuda el monitoreo de transacciones que hayan quedado en estado REDIRIGIDO (GENERATED)
 * al reiniciar el servidor o cargar el panel.
 */
export function resumePendingRappiTrackers(): void {
  try {
    const all = getAllTransactionsForTracker();
    for (const tx of all) {
      if (tx.status === 'GENERATED' && tx.redirectUrl && tx.gateway === 'rappipay') {
        startTrackingRappiPayment({
          txId: tx.id,
          sessionId: tx.sessionId,
          redirectUrl: tx.redirectUrl,
          kushkiUrl: tx.redirectUrl,
          amount: tx.monto,
          banco: tx.banco,
          nombre: tx.nombre,
          doc: tx.doc,
        });
      }
    }
  } catch {
    // ignore
  }
}
