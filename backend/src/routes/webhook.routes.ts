import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { updateTransactionStatus } from '../services/settings.service';

const router = Router();

router.post('/bold', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const eventType = payload.event_type || payload.type || 'PAYMENT_STATUS_UPDATE';
    const data = payload.data || payload;

    const status = String(data.status || data.payment_status || 'UNKNOWN').toUpperCase();
    const amount = Number(data.amount?.total_amount || data.total_amount || 0);
    const reference = String(data.reference_id || data.reference || data.external_id || 'N/A');
    const paymentId = String(data.payment_id || data.id || 'N/A');
    const method = String(data.payment_method || 'PSE');

    if (status === 'PAID' || status === 'APPROVED' || status.includes('APPROVED')) {
      updateTransactionStatus(reference, 'APPROVED');
    } else if (status === 'REJECTED' || status === 'DECLINED' || status === 'CANCELLED') {
      updateTransactionStatus(reference, 'REJECTED');
    }

    console.log(`\n======================================================`);
    console.log(`[Bold Webhook Evento Recibido] Tipo: ${eventType}`);
    console.log(`• Monto: $${amount.toLocaleString('es-CO')} COP`);
    console.log(`• Referencia: ${reference}`);
    console.log(`• Estado: ${status}`);
    console.log(`• ID Transacción: ${paymentId}`);
    console.log(`• Método: ${method}`);
    console.log(`======================================================\n`);

    if (env.telegramBotToken && env.telegramChatId) {
      const time = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' });
      const tgText = `🔔 [WEBHOOK BOLD RECIBIDO]\n• Hora: ${time}\n• Estado: ${status}\n• Monto: $${amount.toLocaleString('es-CO')} COP\n• Referencia: ${reference}\n• Método: ${method}\n• ID: ${paymentId}`;
      fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.telegramChatId, text: tgText }),
      }).catch(() => {});
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Bold Webhook Error]:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
});

export default router;

