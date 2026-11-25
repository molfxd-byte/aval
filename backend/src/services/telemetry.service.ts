import os from 'node:os';
import { env } from '../config/env';
import { getGatewaySettings, formatShortBlockReason } from './settings.service';

async function postTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
  const sendOnce = async (): Promise<boolean> => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
      if (!res.ok || !body?.ok) {
        console.error(
          `[Telegram] Error enviando alerta (HTTP ${res.status}):`,
          body?.description || res.statusText
        );
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[Telegram] Fallo de red enviando alerta:', err?.message || err);
      return false;
    }
  };

  const sent = await sendOnce();
  if (sent) return true;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await sendOnce();
}

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

export async function sendLinkRotationTelegramAlert(params: {
  gateway: string;
  blockedUrl: string;
  nextUrl?: string | null;
  reason: string;
  activeRemaining: number;
  blockedTotal: number;
}): Promise<void> {
  const token = env.telegramBotToken;
  const chatId = env.telegramChatId;
  if (!token || !chatId) return;

  const time = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const rawReason = String(params.reason || '').trim();
  const isTempError = rawReason.includes('[ERROR TEMPORAL / RED - LINK SIGUE ACTIVO]');
  let shortAlertReason: string;
  if (rawReason.includes('006_0769_FRAUD_TRANSACTION_BAD')) {
    shortAlertReason =
      'Link bloqueado por RappiPay (Código: 006_0769_FRAUD_TRANSACTION_BAD - Rechazado por la pasarela)';
  } else if (rawReason.includes('Link de pago PSE rechazado')) {
    shortAlertReason = 'Link bloqueado por RappiPay (Rechazado por la pasarela)';
  } else {
    const cleanSummary = formatShortBlockReason(rawReason);
    shortAlertReason = isTempError
      ? `[Error temporal - Link sigue activo] ${cleanSummary}`
      : cleanSummary;
  }

  const lines = [
    '🚨 [ALERTA DE PASARELA - LINK BLOQUEADO / ROTACIÓN]',
    `💳 Pasarela: ${params.gateway.toUpperCase()}`,
    `❌ Link que dejó de funcionar: ${params.blockedUrl}`,
    `⚠️ Motivo detectado: ${shortAlertReason}`,
    params.nextUrl
      ? `🔄 Nuevo Link Activo (Auto-Rotado): ${params.nextUrl}`
      : '🛑 Rotación: SIN LINKS DE REPUESTO DISPONIBLES EN COLA',
    '────────────────────────',
    `✅ Links Activos restantes: ${params.activeRemaining}`,
    `🚫 Total Links Bloqueados: ${params.blockedTotal}`,
    `🕒 Hora Colombia: ${time}`,
  ];

  await postTelegramMessage(token, chatId, lines.join('\n'));
}

export async function sendPseTerminationTelegramAlert(params: {
  linkUrl: string;
  consecutiveCount: number;
  confirmedTermination: boolean;
  banco?: string;
  monto?: number;
  reason?: string;
  rotatedTo?: string | null;
  activeRemaining?: number;
}): Promise<void> {
  const token = env.telegramBotToken;
  const chatId = env.telegramChatId;
  if (!token || !chatId) return;

  const time = new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const title = params.confirmedTermination
    ? '🚨 [ALERTA PSE - TRANSACTION TERMINATION / LINK BLOQUEADO]'
    : '⚠️ [ALERTA PSE - POSIBLE LINK BLOQUEADO EN PASO 2]';

  const lines = [
    title,
    `🔗 Link afectado: ${params.linkUrl}`,
    `📉 Rechazos consecutivos en PSE: ${params.consecutiveCount}`,
    params.banco ? `🏦 Último banco: ${params.banco}` : '',
    params.monto ? `💵 Monto: $${Number(params.monto).toLocaleString('es-CO')} COP` : '',
    `⚠️ Detalle: ${params.reason || 'Pantalla PSE TransactionTermination (no se pudo realizar)'}`,
    params.confirmedTermination
      ? params.rotatedTo
        ? `🔄 Auto-Rotado a nuevo link: ${params.rotatedTo}`
        : '🛑 Sin links de repuesto en cola — agrega o cambia el link ahora.'
      : '👉 Varios pagos seguidos rebotaron/cerraron en PSE (posible TransactionTermination). Revisa y cambia el link si continúa fallando.',
    params.activeRemaining !== undefined ? `✅ Links Activos restantes: ${params.activeRemaining}` : '',
    `🕒 Hora Colombia: ${time}`,
  ].filter(Boolean);

  await postTelegramMessage(token, chatId, lines.join('\n'));
}



