import { notifySessionPaymentConfirmed } from '../controllers/track.controller';
import { getTransactions, updateTransactionStatus } from './settings.service';

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

export function parseKushkiParams(rawUrl?: string): { token: string; mid: string } | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    const token = parsed.searchParams.get('token') || '';
    const mid = parsed.searchParams.get('mid') || '20000000102117147000';
    if (token) {
      return { token, mid };
    }
  } catch {
    const tokenMatch = rawUrl.match(/[?&]token=([a-zA-Z0-9_-]+)/);
    const midMatch = rawUrl.match(/[?&]mid=([a-zA-Z0-9_-]+)/);
    if (tokenMatch?.[1]) {
      return {
        token: tokenMatch[1],
        mid: midMatch?.[1] || '20000000102117147000',
      };
    }
  }
  return null;
}

export async function queryKushkiTransferStatus(
  token: string,
  mid: string
): Promise<{
  state: 'PENDING' | 'APPROVED' | 'REJECTED';
  rawStatus: string;
  ticketNumber?: string;
}> {
  // 1. Consultar endpoint oficial de estado de transferencia de Kushki PSE
  try {
    const statusRes = await fetch(`https://api.kushkipagos.com/transfer/v1/status/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'Public-Merchant-Id': mid,
        Accept: 'application/json',
      },
    });

    if (statusRes.ok) {
      const body: any = await statusRes.json();
      const rawStatus = String(
        body?.status ||
          body?.transactionStatus ||
          body?.transaction_status ||
          body?.responseText ||
          body?.code ||
          ''
      ).toUpperCase();

      const ticket = String(body?.ticketNumber || body?.transactionReference || body?.trazabilityCode || token);

      if (
        rawStatus === 'APPROVED' ||
        rawStatus === 'APPROVAL' ||
        rawStatus === 'APPROVEDTRANSACTION' ||
        rawStatus === 'OK' ||
        rawStatus === '00' ||
        rawStatus === '000' ||
        rawStatus.includes('APPROVED') ||
        rawStatus.includes('APROBAD') ||
        rawStatus.includes('EXITOS')
      ) {
        return { state: 'APPROVED', rawStatus: rawStatus || 'APPROVED', ticketNumber: ticket };
      }

      if (
        rawStatus === 'REJECTED' ||
        rawStatus === 'DECLINED' ||
        rawStatus === 'DECLINEDTRANSACTION' ||
        rawStatus === 'FAILED' ||
        rawStatus === 'ERROR' ||
        rawStatus === 'CANCELLED' ||
        rawStatus === 'EXPIRED' ||
        rawStatus.includes('REJECT') ||
        rawStatus.includes('DECLIN') ||
        rawStatus.includes('RECHAZ') ||
        rawStatus.includes('FALLID')
      ) {
        return { state: 'REJECTED', rawStatus: rawStatus || 'REJECTED', ticketNumber: ticket };
      }
    }
  } catch {
    // Continúa con inspección del agente de redirección
  }

  // 2. Consultar el agente de transferencia Kushki (sin seguir redirección) para ver si ya retornó al callback final
  try {
    const agentUrl = `https://api.kushkipagos.com/transfer/v1/agent?token=${encodeURIComponent(
      token
    )}&mid=${encodeURIComponent(mid)}&rg=002`;

    const agentRes = await fetch(agentUrl, {
      method: 'GET',
      redirect: 'manual',
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
        return { state: 'APPROVED', rawStatus: 'CALLBACK_APPROVED', ticketNumber: token };
      }

      if (
        locationHeader.includes('rejected') ||
        locationHeader.includes('declined') ||
        locationHeader.includes('rechazada') ||
        locationHeader.includes('failed') ||
        locationHeader.includes('cancel')
      ) {
        return { state: 'REJECTED', rawStatus: 'CALLBACK_REJECTED', ticketNumber: token };
      }
    }
  } catch {
    // ignore
  }

  return { state: 'PENDING', rawStatus: 'PENDING' };
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

  let attempts = 0;
  const maxAttempts = 125; // ~25 minutos (cada 12s)
  const intervalMs = 12000;

  const timer = setInterval(async () => {
    attempts++;

    // Verificar si el admin ya cambió el estado manualmente en el Dashboard
    const currentTx = getTransactions().find((t) => t.id === txId || t.sessionId === sessionId);
    if (currentTx && (currentTx.status === 'APPROVED' || currentTx.status === 'REJECTED')) {
      clearInterval(timer);
      activeRappiTrackers.delete(trackerKey);
      return;
    }

    try {
      const check = await queryKushkiTransferStatus(params.token, params.mid);

      if (check.state === 'APPROVED') {
        clearInterval(timer);
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
          status: check.rawStatus,
        });
        return;
      }

      if (check.state === 'REJECTED') {
        clearInterval(timer);
        activeRappiTrackers.delete(trackerKey);

        updateTransactionStatus(txId, 'REJECTED', {
          errorMessage: `PSE/Kushki cerró la transacción como: ${check.rawStatus}`,
        });

        console.log(
          `[RappiPay / Kushki] ⚠️ [PAGO RECHAZADO/EXPIRADO EN EL BANCO] -> Token: ${params.token} | Estado: ${check.rawStatus}`
        );
        return;
      }
    } catch {
      // Silencioso en caso de error de red temporal
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);
      activeRappiTrackers.delete(trackerKey);
      console.log(`[Rappi/Kushki Tracker] ⏱️ Tiempo de monitoreo finalizado para TX: ${txId}`);
    }
  }, intervalMs);
}
