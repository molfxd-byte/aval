import { env } from '../config/env';
import { getGatewaySettings, detectGatewayFromUrl } from './settings.service';

export interface CreateBoldLinkParams {
  amount: number;
  description?: string;
  reference?: string;
  payerEmail?: string;
  callbackUrl?: string;
  ownerId?: string;
}

export interface BoldLinkApiResponse {
  payload?: {
    payment_link?: string;
    url?: string;
  };
  errors?: Array<{
    type?: string;
    title?: string;
    status_code?: number;
    detail?: string;
    errors?: string;
    code?: string;
  }>;
}

export interface CreateBoldLinkResult {
  url: string;
  referenceId: string;
}

/**
 * Crea un link de pago dinámico con monto cerrado (fijo) vía API oficial de Bold.
 * Endpoint: POST https://integrations.api.bold.co/online/link/v1
 */
export async function createBoldPaymentLink(params: CreateBoldLinkParams): Promise<CreateBoldLinkResult> {
  const settings = getGatewaySettings(params.ownerId);
  let apiKey = (settings.boldApiKey || env.boldApiKey || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    throw new Error('BOLD_API_KEY no está configurada.');
  }

  if (
    apiKey === 'XIhz1m8PhObmGYf47He-4A' ||
    apiKey === 'lSrnVSEddO8lsXCbFEd2gg' ||
    apiKey === 'RadfbORqTA5JrzUMwL_J7Q' ||
    apiKey.length < 30
  ) {
    console.warn('[Bold API] Advertencia: Se detectó una Llave Secreta corta en lugar de la Llave de Identidad.');
  }

  const roundedAmount = Math.round(Number(params.amount));
  if (!roundedAmount || roundedAmount < 1000) {
    throw new Error(`Monto inválido para generar link de Bold: ${params.amount}`);
  }

  const invoiceNum = Math.floor(10000 + Math.random() * 90000);
  const referenceId = params.reference || `PC-${Date.now().toString().slice(-6)}-${invoiceNum}`;
  const merchantName = (settings.boldMerchantName || 'Paycenter').trim();

  const cleanDesc = params.description
    ? `Servicio ${merchantName} - ${params.description.slice(0, 40)}`
    : `Servicio ${merchantName} - Factura #${invoiceNum}`;

  const payload: Record<string, any> = {
    amount_type: 'CLOSE',
    amount: {
      total_amount: roundedAmount,
      currency: 'COP',
    },
    description: cleanDesc,
    reference_id: referenceId,
  };

  if (params.payerEmail && params.payerEmail.includes('@')) {
    payload.payer_email = params.payerEmail.trim();
  } else {
    payload.payer_email = `cliente_${invoiceNum}@gmail.com`;
  }

  if (params.callbackUrl && params.callbackUrl.startsWith('http')) {
    payload.callback_url = params.callbackUrl.trim();
  }

  const endpoint = 'https://integrations.api.bold.co/online/link/v1';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `x-api-key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as BoldLinkApiResponse;

    if (!response.ok || !data.payload?.url) {
      const errorMsg =
        data.errors?.map((e) => e.detail || e.title || e.errors).join(', ') || `HTTP ${response.status}`;
      console.error('[Bold API] Error al generar link:', { status: response.status, data });
      throw new Error(`Bold API error: ${errorMsg}`);
    }

    console.log(
      `[Bold API] Link dinámico generado con éxito: ${data.payload.url} por valor de $${roundedAmount} (Ref: ${referenceId})`
    );
    return {
      url: data.payload.url,
      referenceId,
    };
  } catch (error: any) {
    console.error('[Bold API] Fallo al comunicarse con Bold API:', error?.message || error);
    const fallbackUrl = settings.boldUrl || env.boldDefaultLink;
    if (fallbackUrl) {
      console.warn(`[Bold API] Usando link estático de respaldo: ${fallbackUrl}`);
      return {
        url: fallbackUrl,
        referenceId,
      };
    }
    throw error;
  }
}

/**
 * Verifica en vivo si la Llave de Identidad de Bold y/o un Link están activos en Bold.
 */
export async function verifyBoldAccountStatus(customApiKey?: string, customBoldUrl?: string): Promise<{
  ok: boolean;
  status: string;
  merchantDescription?: string;
  detail: string;
}> {
  const settings = getGatewaySettings();
  const apiKey = (customApiKey || settings.boldApiKey || '').trim().replace(/^["']|["']$/g, '');
  const boldUrl = (customBoldUrl || settings.boldUrl || '').trim();

  if (!apiKey || apiKey.length < 30) {
    return {
      ok: false,
      status: 'INVALID_KEY',
      detail: 'La Llave de Identidad debe tener al menos 30 caracteres (no confundir con la Llave Secreta de 22 caracteres).',
    };
  }

  // Si hay un link LNK_..., consultarlo primero para obtener también el nombre del comercio
  const info = detectGatewayFromUrl(boldUrl);
  if (info.linkId && info.linkId.startsWith('LNK_')) {
    try {
      const res = await fetch(`https://integrations.api.bold.co/online/link/v1/${info.linkId}`, {
        headers: { 'Authorization': `x-api-key ${apiKey}` },
      });
      const data = (await res.json()) as any;
      if (res.ok && data.status) {
        return {
          ok: data.status === 'ACTIVE',
          status: data.status,
          merchantDescription: (data.description || '').trim() || undefined,
          detail: `Comercio activo. Link ${info.linkId} en estado ${data.status} (${(data.description || 'Sin descripción').trim()}).`,
        };
      }
      if (data.errors) {
        const errText = data.errors.map((e: any) => e.errors || e.detail || e.title || JSON.stringify(e)).join(', ');
        return {
          ok: false,
          status: 'BLOCKED_OR_ERROR',
          detail: errText,
        };
      }
    } catch (err: any) {
      // Continuar a prueba general
    }
  }

  // Prueba consultando el endpoint de notificaciones con referencia dummy
  try {
    const res = await fetch(
      `https://integrations.api.bold.co/payments/webhook/notifications/PING_${Date.now()}?is_external_reference=true`,
      {
        headers: { 'Authorization': `x-api-key ${apiKey}` },
      }
    );
    if (res.ok) {
      return {
        ok: true,
        status: 'ACTIVE',
        detail: 'Llave de Identidad válida y autenticada correctamente con Bold API.',
      };
    }
    const errData = (await res.json().catch(() => ({}))) as any;
    return {
      ok: false,
      status: `HTTP_${res.status}`,
      detail: errData.message || errData.Message || 'Llave rechazada por Bold API.',
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 'NETWORK_ERROR',
      detail: err.message || 'Error de red conectando con Bold API.',
    };
  }
}
