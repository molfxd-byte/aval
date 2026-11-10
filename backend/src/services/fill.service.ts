import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env';

export interface FillRequest {
  monto: string;
  banco: string;
  tipo: string;
  doc: string;
  url?: string;
}

export interface FillResponse {
  enabled: boolean;
  png?: string;
  redirect_url: string;
}

export function executeFillReal(data: FillRequest): Promise<FillResponse> {
  return new Promise((resolve, reject) => {
    const pythonPath = env.pythonBin || 'python';
    const scriptPath = path.resolve(__dirname, '../../scripts/fill_real.py');

    const proc = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PROXY_HOST: env.proxyHost,
        PROXY_PORT: env.proxyPort,
        PROXY_USERNAME: env.proxyUsername,
        PROXY_PASSWORD: env.proxyPassword,
        PAYMENT_AUTOMATION_URL: env.paymentAutomationUrl,
      },
    });

    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar el proceso de automatización: ${err.message}`));
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
          // Fallback buscando líneas que parezcan JSON
          const lines = stdoutData.trim().split(/\r?\n/).reverse();
          const found = lines.find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
          if (found) jsonString = found.trim();
        }

        if (!jsonString) {
          throw new Error(`No se encontró bloque JSON en la salida.`);
        }

        const result = JSON.parse(jsonString) as FillResponse;
        resolve(result);
      } catch (err: any) {
        reject(new Error(`Respuesta inválida del script: ${err.message}. Salida: ${stdoutData}`));
      }
    });

    // Enviar datos vía stdin como JSON con la URL configurada
    const payload = {
      ...data,
      url: data.url || env.paymentAutomationUrl,
    };
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

