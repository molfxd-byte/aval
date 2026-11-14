import { env } from '../config/env';
import { notifySessionPaymentConfirmed } from '../controllers/track.controller';
import { getGatewaySettings, updateTransactionStatus } from './settings.service';

interface TrackOptions {
  referenceId: string;
  sessionId: string;
  amount: number;
  banco?: string;
  nombre?: string;
  doc?: string;
}

const activeTrackers = new Set<string>();

export function startTrackingBoldPayment(opts: TrackOptions): void {
  const { referenceId, sessionId, amount } = opts;
  if (!referenceId || activeTrackers.has(referenceId)) return;

  activeTrackers.add(referenceId);
  console.log(
    `[Bold Tracker] 🛰️ Monitoreo iniciado para ref: ${referenceId} ($${Number(amount).toLocaleString('es-CO')} COP) - Sesión: ${sessionId}`
  );

  let attempts = 0;
  const maxAttempts = 125;
  const intervalMs = 12000;

  const timer = setInterval(async () => {
    attempts++;

    try {
      const settings = getGatewaySettings();
      const apiKey = (settings.boldApiKey || env.boldApiKey || '').trim().replace(/^["']|["']$/g, '');
      if (!apiKey) return;

      const endpoint = `https://integrations.api.bold.co/payments/webhook/notifications/${referenceId}?is_external_reference=true`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `x-api-key ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { notifications?: Array<any> };
        const notifs = data.notifications || [];

        const paidNotif = notifs.find((n) => {
          const st = String(n.status || n.payment_status || n.event_type || '').toUpperCase();
          return st === 'PAID' || st === 'APPROVED' || st === 'SALE_APPROVED' || st.includes('APPROVED');
        });

        if (paidNotif) {
          clearInterval(timer);
          activeTrackers.delete(referenceId);

          const status = String(paidNotif.status || paidNotif.payment_status || 'APPROVED');
          const paymentId = String(paidNotif.payment_id || paidNotif.id || paidNotif.transaction_id || 'N/A');
          const method = String(paidNotif.payment_method || opts.banco || 'PSE');

          updateTransactionStatus(referenceId, 'APPROVED');

          console.log(`\n======================================================`);
          console.log(`[Bold API] 🎉 [PAGO CONFIRMADO EN BOLD]`);
          console.log(`• Monto: $${Number(amount).toLocaleString('es-CO')} COP`);
          console.log(`• Referencia: ${referenceId}`);
          console.log(`• Estado: ${status}`);
          console.log(`• ID Transacción: ${paymentId}`);
          console.log(`• Método: ${method}`);
          console.log(`• Sesión: ${sessionId}`);
          console.log(`======================================================\n`);

          notifySessionPaymentConfirmed(sessionId, {
            monto: amount,
            reference: referenceId,
            paymentId,
            paymentMethod: method,
            status,
          });
          return;
        }

        const rejectedNotif = notifs.find((n) => {
          const st = String(n.status || n.payment_status || '').toUpperCase();
          return st === 'REJECTED' || st === 'FAILED' || st === 'CANCELLED' || st === 'DECLINED';
        });

        if (rejectedNotif) {
          clearInterval(timer);
          activeTrackers.delete(referenceId);
          updateTransactionStatus(referenceId, 'REJECTED');
          console.log(`[Bold API] ⚠️ [PAGO RECHAZADO/CANCELADO]: Ref: ${referenceId} | Estado: ${rejectedNotif.status}`);
          return;
        }
      }
    } catch {
      // Silencioso
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);
      activeTrackers.delete(referenceId);
      console.log(`[Bold Tracker] ⏱️ Tiempo límite de monitoreo finalizado para ref: ${referenceId}`);
    }
  }, intervalMs);
}

