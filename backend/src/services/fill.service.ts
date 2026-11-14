import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env';
import { createBoldPaymentLink } from './bold-api.service';
import {
  getGatewaySettings,
  incrementRappiLinkUse,
  markLinkBlockedAndRotate,
} from './settings.service';
import { sendLinkRotationTelegramAlert } from './telemetry.service';

export interface FillRequest {
  monto: string;
  banco: string;
  tipo: string;
  doc: string;
  nombre?: string;
  email?: string;
  celular?: string;
  url?: string;
}

export interface FillResponse {
  enabled: boolean;
  png?: string;
  redirect_url: string;
  kushki_url?: string;
  proxy_ip?: string;
  reference_id?: string;
  gateway_used?: string;
}

export async function executeFillBoldApi(data: FillRequest): Promise<FillResponse> {
  const amount = Number(data.monto);
  const result = await createBoldPaymentLink({
    amount,
    payerEmail: data.email,
    description: data.banco || 'Servicio',
  });

  return {
    enabled: true,
    redirect_url: result.url,
    reference_id: result.referenceId,
    gateway_used: 'bold_api',
  };
}

export async function executeFill(data: FillRequest): Promise<FillResponse> {
  const settings = getGatewaySettings();
  const provider = settings.gatewayProvider;

  if (provider === 'bold_api') {
    try {
      return await executeFillBoldApi(data);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (
        msg.toLowerCase().includes('not active') ||
        msg.toLowerCase().includes('inhabilitado') ||
        msg.includes('PL_000')
      ) {
        const rot = markLinkBlockedAndRotate(settings.boldUrl, msg, 'bold_api');
        sendLinkRotationTelegramAlert({
          gateway: 'bold_api',
          blockedUrl: settings.boldUrl,
          nextUrl: null,
          reason: msg,
          activeRemaining: rot.activeRemaining,
          blockedTotal: rot.blockedTotal,
        }).catch(() => {});
      }
      throw err;
    }
  }

  if (provider === 'bold') {
    try {
      return await executeFillBold(data);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const usedUrl = data.url || settings.boldUrl;
      if (
        msg.toLowerCase().includes('inhabilitado') ||
        msg.toLowerCase().includes('rechazado') ||
        msg.toLowerCase().includes('disabled')
      ) {
        const rot = markLinkBlockedAndRotate(usedUrl, msg, 'bold');
        sendLinkRotationTelegramAlert({
          gateway: 'bold',
          blockedUrl: usedUrl,
          nextUrl: null,
          reason: msg,
          activeRemaining: rot.activeRemaining,
          blockedTotal: rot.blockedTotal,
        }).catch(() => {});
      }
      throw err;
    }
  }

  // Modo RappiPay con auto-rotación en caso de bloqueo del link
  const currentRappiUrl = data.url || settings.rappiUrl || settings.paymentUrl;
  try {
    const res = await executeFillReal({ ...data, url: currentRappiUrl });
    incrementRappiLinkUse(currentRappiUrl);
    return res;
  } catch (err: any) {
    const msg = String(err?.message || 'Error en link de RappiPay');
    const isInputValidationError = msg.includes('inferior al mínimo permitido');

    if (!isInputValidationError) {
      const rotation = markLinkBlockedAndRotate(currentRappiUrl, msg, 'rappipay');
      sendLinkRotationTelegramAlert({
        gateway: 'rappipay',
        blockedUrl: currentRappiUrl,
        nextUrl: rotation.rotatedTo,
        reason: msg,
        activeRemaining: rotation.activeRemaining,
        blockedTotal: rotation.blockedTotal,
      }).catch(() => {});

      // Si hay un link de repuesto en la cola y no fue una prueba explícita a una URL fija, reintentar automáticamente
      if (rotation.rotatedTo && !data.url) {
        console.log(`[Auto-Rotación RappiPay] Reintentando cobro automáticamente con nuevo link: ${rotation.rotatedTo}`);
        const retryRes = await executeFillReal({ ...data, url: rotation.rotatedTo });
        incrementRappiLinkUse(rotation.rotatedTo);
        return retryRes;
      }
    }
    throw err;
  }
}

export function executeFillBold(data: FillRequest): Promise<FillResponse> {
  return new Promise((resolve, reject) => {
    const settings = getGatewaySettings();
    const pythonPath = env.pythonBin || 'python';
    const scriptPath = path.resolve(__dirname, '../../scripts/fill_bold.py');

    const proc = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PROXY_HOST: settings.proxyHost || env.proxyHost,
        PROXY_PORT: settings.proxyPort || env.proxyPort,
        PROXY_SOCKS_PORT: settings.proxyPort || env.proxySocksPort,
        PROXY_USERNAME: settings.proxyUsername || env.proxyUsername,
        PROXY_PASSWORD: settings.proxyPassword || env.proxyPassword,
        PAYMENT_BOLD_URL: settings.boldUrl || env.paymentBoldUrl,
      },
    });

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      process.stderr.write(chunk);
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar la automatización de Bold: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `El proceso de Bold falló (código ${code}): ${stderrData || stdoutData || 'Error desconocido'}`
          )
        );
      }

      try {
        const startMarker = '---JSON_START---';
        const endMarker = '---JSON_END---';

        let jsonString = '';
        if (stdoutData.includes(startMarker) && stdoutData.includes(endMarker)) {
          jsonString = stdoutData.split(startMarker)[1].split(endMarker)[0].trim();
        } else {
          const lines = stdoutData.trim().split(/\r?\n/).reverse();
          const found = lines.find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
          if (found) jsonString = found.trim();
        }

        if (!jsonString) {
          throw new Error('No se encontró bloque JSON en la salida de Bold.');
        }

        const result = JSON.parse(jsonString) as FillResponse;
        result.gateway_used = 'bold';
        resolve(result);
      } catch (err: any) {
        reject(new Error(`Respuesta inválida de Bold: ${err.message}. Salida: ${stdoutData}`));
      }
    });

    const payload = {
      ...data,
      url: data.url || settings.boldUrl || env.paymentBoldUrl,
    };
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

export function executeFillReal(data: FillRequest): Promise<FillResponse> {
  return new Promise((resolve, reject) => {
    const settings = getGatewaySettings();
    const pythonPath = env.pythonBin || 'python';
    const scriptPath = path.resolve(__dirname, '../../scripts/fill_real.py');

    const proc = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PROXY_HOST: settings.proxyHost || env.proxyHost,
        PROXY_PORT: settings.proxyPort || env.proxyPort,
        PROXY_SOCKS_PORT: settings.proxyPort || env.proxySocksPort,
        PROXY_USERNAME: settings.proxyUsername || env.proxyUsername,
        PROXY_PASSWORD: settings.proxyPassword || env.proxyPassword,
        PAYMENT_AUTOMATION_URL: settings.rappiUrl || env.paymentAutomationUrl,
      },
    });

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      process.stderr.write(chunk);
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar el proceso de automatización de RappiPay: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `El proceso de llenado falló (código ${code}): ${stderrData || stdoutData || 'Error desconocido'}`
          )
        );
      }

      try {
        const startMarker = '---JSON_START---';
        const endMarker = '---JSON_END---';

        let jsonString = '';
        if (stdoutData.includes(startMarker) && stdoutData.includes(endMarker)) {
          jsonString = stdoutData.split(startMarker)[1].split(endMarker)[0].trim();
        } else {
          const lines = stdoutData.trim().split(/\r?\n/).reverse();
          const found = lines.find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
          if (found) jsonString = found.trim();
        }

        if (!jsonString) {
          throw new Error('No se encontró bloque JSON en la salida.');
        }

        const result = JSON.parse(jsonString) as FillResponse;
        result.gateway_used = 'rappipay';
        resolve(result);
      } catch (err: any) {
        reject(new Error(`Respuesta inválida del script: ${err.message}. Salida: ${stdoutData}`));
      }
    });

    const payload = {
      ...data,
      url: data.url || settings.rappiUrl || env.paymentAutomationUrl,
    };
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}
