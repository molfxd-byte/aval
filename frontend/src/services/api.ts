const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export class ApiFetchError extends Error {
  status?: number;
  isTimeout: boolean;

  constructor(message: string, status?: number, isTimeout = false) {
    super(message);
    this.name = 'ApiFetchError';
    this.status = status;
    this.isTimeout = isTimeout;
  }
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = 65000, signal: externalSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      window.clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
      ...fetchOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `Error ${response.status}: ${response.statusText}`;
      try {
        const errBody = await response.json();
        if (errBody?.error) detail = String(errBody.error);
      } catch {
        // ignore non-json error response (e.g. 502/504 gateway timeout HTML)
      }
      const isGatewayTimeout = response.status === 408 || response.status === 502 || response.status === 504;
      throw new ApiFetchError(detail, response.status, isGatewayTimeout);
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiFetchError) throw err;
    if (timedOut) {
      throw new ApiFetchError('Tiempo de espera agotado al conectar con la pasarela.', 504, true);
    }
    if (err?.name === 'AbortError') {
      throw new ApiFetchError('Operación cancelada por el usuario.', 0, false);
    }
    throw new ApiFetchError(err?.message || 'Error de conexión con el servidor.', undefined, true);
  } finally {
    window.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
