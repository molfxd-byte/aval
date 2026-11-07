import { Request, Response } from 'express';
import { env } from '../config/env';

// Rastrea pasos de navegación del usuario y los reenvía a Telegram.
// Solo etiquetas de paso: nunca datos de formularios de pago.
export async function postTrack(req: Request, res: Response) {
  const step = String((req.body?.step ?? '') as string).slice(0, 200).trim();
  const detail = String((req.body?.detail ?? '') as string).slice(0, 500).trim();
  if (!step) return res.status(400).json({ ok: false, error: 'step requerido' });

  if (env.telegramBotToken && env.telegramChatId) {
    const text = `🧭 ${step}${detail ? `\n${detail}` : ''}`;
    try {
      await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.telegramChatId, text }),
      });
    } catch {
      // No bloquear al usuario si Telegram falla.
    }
  }
  res.json({ ok: true });
}
