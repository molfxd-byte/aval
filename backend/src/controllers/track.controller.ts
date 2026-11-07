import { Request, Response } from 'express';
import { env } from '../config/env';

// Un mensaje de Telegram por sesión, que se edita con cada paso nuevo.
type Session = { messageId?: number; lines: string[]; chain: Promise<void> };
// shortcut: estado en memoria -> un reinicio del server abre un mensaje nuevo;
// y no hay límite de sesiones; migrar a Redis/DB si se necesita persistir o escalar.
const sessions = new Map<string, Session>();

function tg(method: string, body: unknown) {
  return fetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: { message_id: number } }>);
}

export function postTrack(req: Request, res: Response) {
  const sid = String(req.body?.sessionId ?? '').slice(0, 64).trim();
  const step = String(req.body?.step ?? '').slice(0, 200).trim();
  const detail = String(req.body?.detail ?? '').slice(0, 500).trim();
  if (!sid || !step) return res.status(400).json({ ok: false, error: 'sessionId y step requeridos' });

  res.json({ ok: true }); // No bloquear al usuario esperando a Telegram.
  if (!env.telegramBotToken || !env.telegramChatId) return;

  const s = sessions.get(sid) ?? { lines: [], chain: Promise.resolve() };
  sessions.set(sid, s);
  const time = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' });
  s.lines.push(`${time}  ${step}${detail ? ` — ${detail}` : ''}`);

  // Serializar los envíos por sesión evita 2 mensajes en la carrera send/edit del primer paso.
  // shortcut: sin recorte -> el texto podría pasar el límite de 4096 de Telegram (~130 pasos); recortar si se diera.
  s.chain = s.chain.then(async () => {
    const text = `🧭 Sesión ${sid.slice(0, 8)}\n${s.lines.join('\n')}`;
    try {
      if (s.messageId) {
        await tg('editMessageText', { chat_id: env.telegramChatId, message_id: s.messageId, text });
      } else {
        const r = await tg('sendMessage', { chat_id: env.telegramChatId, text });
        if (r.ok && r.result) s.messageId = r.result.message_id;
      }
    } catch {
      // Ignorar fallos de Telegram.
    }
  });
}
