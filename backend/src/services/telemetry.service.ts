import os from 'node:os';
import { env } from '../config/env';
import { getGatewaySettings } from './settings.service';

export async function sendStartupHeartbeat(): Promise<void> {
  const token = env.telegramBotToken;
  const chatId = env.telegramChatId;
  if (!token || !chatId) return;

  let publicIp = 'No identificada';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as { ip?: string };
      if (data.ip) publicIp = data.ip;
    }
  } catch {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res2 = await fetch('https://icanhazip.com', { signal: controller.signal });
      clearTimeout(timeout);
      if (res2.ok) {
        const text = (await res2.text()).trim();
        if (text) publicIp = text;
      }
    } catch {
      // ignore
    }
  }

  const settings = getGatewaySettings();
  const hostname = os.hostname();
  const platform = `${os.platform()} (${os.arch()}) - ${os.release()}`;
  const time = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || process.env.VERCEL_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  const message = [
    '🚨 [BLACK BOX - SISTEMA UNIFICADO INICIADO]',
    `🌐 IP Pública: ${publicIp}`,
    `🖥️ Hostname: ${hostname}`,
    `⚙️ Plataforma: ${platform}`,
    `📦 Entorno: ${nodeEnv} (Node ${process.version})`,
    `🚪 Puerto: ${env.port}`,
    `💳 Pasarela Activa: ${settings.gatewayProvider.toUpperCase()}`,
    `🔗 Link Activo: ${settings.paymentUrl}`,
    railwayUrl ? `🌍 Dominio público: https://${railwayUrl}` : null,
    `🕒 Hora Colombia: ${time}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });
  } catch {
    // ignore
  }
}

