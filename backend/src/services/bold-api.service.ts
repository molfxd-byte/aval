import { env } from '../config/env';

export interface CreateBoldLinkParams {
  amount: number;
  description?: string;
  reference?: string;
  payerEmail?: string;
  callbackUrl?: string;
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
  }>;
}

/**
 * Crea un link de pago dinámico con monto cerrado (fijo) vía API oficial de Bold.
 * Endpoint: POST https://integrations.api.bold.co/online/link/v1
 */
export async function createBoldPaymentLink(params: CreateBoldLinkParams): Promise<string> {
  let apiKey = (env.boldApiKey || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    throw new Error('BOLD_API_KEY no está configurada en las variables de entorno.');
  }

  // La API de Bold exige obligatoriamente la Llave de Identidad (43 caracteres) en 'Authorization: x-api-key ...'.
  // Si en Railway o en las variables de entorno se colocó por error la Llave Secreta (22 caracteres como lSrnVSEddO8lsXCbFEd2gg),
  // AWS API Gateway deniega el acceso con error 403 explicit deny.
  if (apiKey === 'lSrnVSEddO8lsXCbFEd2gg' || apiKey === 'RadfbORqTA5JrzUMwL_J7Q' || apiKey.length < 30) {
    console.warn('[Bold API] Advertencia: Se detectó la Llave Secreta en BOLD_API_KEY. Usando automáticamente la Llave de Identidad oficial.');
    apiKey = 'kJDR5OBIFNerMfczVH_ZL2eY4xyCZWWQnnuwHh8Z6ZA';
  }

  const roundedAmount = Math.round(Number(params.amount));
  if (!roundedAmount || roundedAmount < 1000) {
    throw new Error(`Monto inválido para generar link de Bold: ${params.amount}`);
  }

  const payload: Record<string, any> = {
    amount_type: 'CLOSE',
    amount: {
      total_amount: roundedAmount,
      currency: 'COP',
    },
    description: params.description || 'Pago a Variedad luxxo',
    reference_id: params.reference || `AVAL_${Date.now()}`,
  };

  if (params.payerEmail && params.payerEmail.includes('@')) {
    payload.payer_email = params.payerEmail.trim();
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
      const errorMsg = data.errors?.map((e) => e.detail || e.title).join(', ') || `HTTP ${response.status}`;
      console.error('[Bold API] Error al generar link:', { status: response.status, data });
      throw new Error(`Bold API error: ${errorMsg}`);
    }

    console.log(`[Bold API] Link dinámico generado con éxito: ${data.payload.url} por valor de $${roundedAmount}`);
    return data.payload.url;
  } catch (error: any) {
    console.error('[Bold API] Fallo al comunicarse con Bold API:', error?.message || error);
    // Si falla la API y tenemos un link estático de respaldo, podemos usarlo como fallback
    if (env.boldDefaultLink) {
      console.warn(`[Bold API] Usando link estático de respaldo: ${env.boldDefaultLink}`);
      return env.boldDefaultLink;
    }
    throw error;
  }
}
