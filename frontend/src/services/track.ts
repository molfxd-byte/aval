import { apiFetch } from './api';

// Un id estable por sesión de navegador: agrupa todos los pasos en un mismo mensaje.
export function getTrackSessionId(): string {
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
export function track(step: string, detail?: string): void {
  apiFetch('/track', {
    method: 'POST',
    body: JSON.stringify({ sessionId: getTrackSessionId(), step, detail }),
  }).catch(() => {
    // El rastreo nunca debe afectar la experiencia del usuario.
  });
}
