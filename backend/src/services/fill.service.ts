import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env';
import { createBoldPaymentLink } from './bold-api.service';
import { getGatewaySettings } from './settings.service';

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

export function executeFill(data: FillRequest): Promise<FillResponse> {
  const settings = getGatewaySettings();
  const provider = settings.gatewayProvider;

  if (provider === 'bold_api') {
    return executeFillBoldApi(data);
  }
  if (provider === 'bold') {
    return executeFillBold(data);
  }
  return executeFillReal(data);
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
