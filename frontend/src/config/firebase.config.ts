export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

const STORAGE_CONFIG_KEY = 'avalpay_firebase_config';
const STORAGE_AUTH_USER_KEY = 'avalpay_firebase_user';

// Credenciales oficiales del proyecto Firebase (dashboard-48ef5)
const defaultFirebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAxXYnL6DcsiClvZqEjPUFgAKdHatVMzSM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dashboard-48ef5.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dashboard-48ef5',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dashboard-48ef5.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '825454673198',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:825454673198:web:5e24f6503599c90e424ebf',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-S906PRC1EX',
};

export function getFirebaseConfig(): FirebaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FirebaseConfig>;
      if (parsed.apiKey && parsed.projectId) {
        return {
          apiKey: parsed.apiKey,
          authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
          projectId: parsed.projectId,
          storageBucket: parsed.storageBucket || '',
          messagingSenderId: parsed.messagingSenderId || '',
          appId: parsed.appId || '',
          measurementId: parsed.measurementId || '',
        };
      }
    }
  } catch {
    // ignore
  }
  return defaultFirebaseConfig;
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.apiKey.length > 10 && cfg.projectId);
}

export function saveCustomFirebaseConfig(rawInput: string | FirebaseConfig): FirebaseConfig {
  if (typeof rawInput !== 'string') {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(rawInput));
    return rawInput;
  }

  const extract = (key: string) => {
    const regex = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
    const match = rawInput.match(regex);
    return match ? match[1].trim() : '';
  };

  const apiKey = extract('apiKey');
  const projectId = extract('projectId');
  const authDomain = extract('authDomain') || (projectId ? `${projectId}.firebaseapp.com` : '');
  const storageBucket = extract('storageBucket');
  const messagingSenderId = extract('messagingSenderId');
  const appId = extract('appId');
  const measurementId = extract('measurementId');

  if (!apiKey || !projectId) {
    throw new Error('No se encontraron apiKey y projectId válidos en el texto pegado.');
  }

  const cfg: FirebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
  };

  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
  return cfg;
}

export interface FirebaseAuthUser {
  uid: string;
  email: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export function getCurrentAuthUser(): FirebaseAuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_AUTH_USER_KEY) || localStorage.getItem(STORAGE_AUTH_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as FirebaseAuthUser;
    if (user.expiresAt && Date.now() > user.expiresAt) {
      sessionStorage.removeItem(STORAGE_AUTH_USER_KEY);
      localStorage.removeItem(STORAGE_AUTH_USER_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function logoutFirebaseUser(): void {
  sessionStorage.removeItem(STORAGE_AUTH_USER_KEY);
  localStorage.removeItem(STORAGE_AUTH_USER_KEY);
}

function mapFirebaseAuthError(code: string): string {
  if (
    code.includes('INVALID_LOGIN_CREDENTIALS') ||
    code.includes('INVALID_PASSWORD') ||
    code.includes('EMAIL_NOT_FOUND')
  ) {
    return 'Correo o contraseña incorrectos en Firebase Auth.';
  }
  if (code.includes('EMAIL_EXISTS')) {
    return 'Este correo ya está registrado en Firebase Auth. Inicia sesión con tu contraseña.';
  }
  if (code.includes('WEAK_PASSWORD')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (code.includes('CONFIGURATION_NOT_FOUND') || code.includes('OPERATION_NOT_ALLOWED')) {
    return 'Debes habilitar el proveedor "Correo electrónico/contraseña" en Firebase Console -> Authentication -> Sign-in method.';
  }
  if (code.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return 'Demasiados intentos fallidos. Intenta más tarde.';
  }
  if (code.includes('API_KEY_INVALID')) {
    return 'La API Key de Firebase configurada no es válida.';
  }
  return `Error de Firebase Auth: ${code}`;
}

/**
 * Autentica al usuario contra Firebase Authentication REST API oficial (Identity Toolkit)
 */
export async function signInWithFirebaseEmail(email: string, password: string): Promise<FirebaseAuthUser> {
  const cfg = getFirebaseConfig();

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
    cfg.apiKey
  )}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
      returnSecureToken: true,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const code = data?.error?.message || 'AUTH_ERROR';
    throw new Error(mapFirebaseAuthError(code));
  }

  const user: FirebaseAuthUser = {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
  };

  sessionStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(user));
  return user;
}

/**
 * Registra un nuevo usuario administrador en Firebase Authentication (Identity Toolkit)
 */
export async function signUpWithFirebaseEmail(email: string, password: string): Promise<FirebaseAuthUser> {
  const cfg = getFirebaseConfig();

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
    cfg.apiKey
  )}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
      returnSecureToken: true,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const code = data?.error?.message || 'SIGNUP_ERROR';
    throw new Error(mapFirebaseAuthError(code));
  }

  const user: FirebaseAuthUser = {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
  };

  sessionStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(user));
  return user;
}

/**
 * Sincroniza opcionalmente la configuración de pasarela con Cloud Firestore (si las reglas permiten request.auth != null)
 */
export async function syncGatewayToFirestore(
  idToken: string,
  payload: Record<string, string>
): Promise<{ synced: boolean; detail?: string }> {
  try {
    const cfg = getFirebaseConfig();
    if (!cfg.projectId || !idToken) return { synced: false };

    const fields: Record<string, { stringValue: string }> = {};
    for (const [k, v] of Object.entries(payload)) {
      fields[k] = { stringValue: String(v ?? '') };
    }
    fields.updatedAt = { stringValue: new Date().toISOString() };

    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/(default)/documents/avalpay_config/gateway`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      return { synced: false, detail: 'Firestore bloqueado por reglas (allow read, write: if false)' };
    }
    return { synced: true };
  } catch {
    return { synced: false };
  }
}

