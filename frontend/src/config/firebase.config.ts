export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const STORAGE_CONFIG_KEY = 'avalpay_firebase_config';
const STORAGE_AUTH_USER_KEY = 'avalpay_firebase_user';

// Credenciales por defecto desde variables de entorno (se actualizarán cuando envíes las credenciales de tu proyecto Firebase)
const defaultFirebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
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

  // Permite pegar directamente el bloque de código que da Firebase Console (const firebaseConfig = { ... })
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
  isPreConfigSession?: boolean;
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

/**
 * Autentica al usuario contra Firebase Authentication REST API oficial (Identity Toolkit)
 */
export async function signInWithFirebaseEmail(email: string, password: string): Promise<FirebaseAuthUser> {
  const cfg = getFirebaseConfig();

  if (!cfg.apiKey) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }

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
    if (code.includes('INVALID_LOGIN_CREDENTIALS') || code.includes('INVALID_PASSWORD') || code.includes('EMAIL_NOT_FOUND')) {
      throw new Error('Correo o contraseña incorrectos en Firebase Auth.');
    }
    if (code.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
      throw new Error('Demasiados intentos fallidos. Intenta más tarde.');
    }
    if (code.includes('API_KEY_INVALID')) {
      throw new Error('La API Key de Firebase configurada no es válida.');
    }
    throw new Error(`Error de Firebase Auth: ${code}`);
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

export function startPreConfigSession(email: string): FirebaseAuthUser {
  const user: FirebaseAuthUser = {
    uid: 'admin-local',
    email: email || 'admin@avalpay.local',
    idToken: 'pre-config-token',
    expiresAt: Date.now() + 12 * 3600 * 1000,
    isPreConfigSession: true,
  };
  sessionStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(user));
  return user;
}

