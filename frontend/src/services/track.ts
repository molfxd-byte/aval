import { apiFetch } from './api';

// Un id estable por sesión de navegador: agrupa todos los pasos en un mismo mensaje.
function sessionId(): string {
  try {
    let id = sessionStorage.getItem('trackSid');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('trackSid', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// Envía un paso de navegación al backend (que lo acumula y edita en Telegram).
// Pasa solo etiquetas/paths, nunca valores de formularios de pago.
export function track(step: string, detail?: string): void {
  apiFetch('/track', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sessionId(), step, detail }),
  }).catch(() => {
    // El rastreo nunca debe afectar la experiencia del usuario.
  });
}
