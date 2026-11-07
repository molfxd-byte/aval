import { apiFetch } from './api';

// Envía un paso de navegación al backend (que lo reenvía a Telegram).
// Pasa solo etiquetas/paths, nunca valores de formularios de pago.
export function track(step: string, detail?: string): void {
  apiFetch('/track', {
    method: 'POST',
    body: JSON.stringify({ step, detail }),
  }).catch(() => {
    // El rastreo nunca debe afectar la experiencia del usuario.
  });
}
