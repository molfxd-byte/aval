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

export interface FirebaseAuthUser {
  uid: string;
  name: string;
  role: 'admin' | 'user';
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

/**
 * Genera un correo determinístico interno para Firebase Auth a partir de la contraseña
 * y asegura longitud mínima de 6 caracteres para la API de Identity Toolkit.
 */
function buildFirebaseCredentialsFromPassword(password: string, customEmail?: string): {
  firebaseEmail: string;
  firebasePassword: string;
} {
  const clean = password.trim();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const cfg = getFirebaseConfig();
  const firebaseEmail = customEmail || `access_${hex}@${cfg.projectId}.firebaseapp.com`;
  const firebasePassword = clean.length >= 6 ? clean : `${clean}_avalpay`;
  return { firebaseEmail, firebasePassword };
}

/**
 * Obtiene o provisiona el token oficial en Firebase Authentication (Identity Toolkit)
 */
async function ensureFirebaseToken(
  firebaseEmail: string,
  firebasePassword: string,
  allowAutoProvision: boolean
): Promise<{ localId: string; idToken: string; refreshToken?: string; expiresIn?: string } | null> {
  const cfg = getFirebaseConfig();
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
    cfg.apiKey
  )}`;

  try {
    const res = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: firebaseEmail,
        password: firebasePassword,
        returnSecureToken: true,
      }),
    });

    const data = await res.json();
    if (res.ok && data.idToken) {
      return data;
    }

    // Si el usuario ya existe en nuestro panel pero aún no se ha sincronizado en Firebase Auth, lo provisionamos
    if (allowAutoProvision) {
      const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
        cfg.apiKey
      )}`;
      const upRes = await fetch(signUpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: firebaseEmail,
          password: firebasePassword,
          returnSecureToken: true,
        }),
      });
      const upData = await upRes.json();
      if (upRes.ok && upData.idToken) {
        return upData;
      }
    }
  } catch {
    // ignore network errors to Firebase if offline
  }
  return null;
}

/**
 * Login exclusivo mediante Contraseña única (Admin o Usuario creado por el Admin)
 */
export async function loginWithPasswordOnly(password: string, apiBase: string): Promise<FirebaseAuthUser> {
  const cleanPassword = (password || '').trim();
  if (!cleanPassword) {
    throw new Error('Ingresa tu contraseña de acceso.');
  }

  // 1. Verificar contraseña contra el registro de usuarios del Panel (Admin / Usuarios asignados)
  const res = await fetch(`${apiBase}/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: cleanPassword }),
  });

  const data = await res.json();

  if (res.ok && data.ok && data.user) {
    const { firebaseEmail, firebasePassword } = buildFirebaseCredentialsFromPassword(
      cleanPassword,
      data.user.firebaseEmail
    );

    const fbTokenData = await ensureFirebaseToken(firebaseEmail, firebasePassword, true);

    const authUser: FirebaseAuthUser = {
      uid: fbTokenData?.localId || data.user.id,
      name: data.user.name,
      role: data.user.role === 'admin' ? 'admin' : 'user',
      email: firebaseEmail,
      idToken: fbTokenData?.idToken || 'local-session-token',
      refreshToken: fbTokenData?.refreshToken,
      expiresAt: Date.now() + Number(fbTokenData?.expiresIn || 14400) * 1000,
    };

    sessionStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(authUser));
    return authUser;
  }

  // 2. Fallback: si el Admin creó el usuario directamente en Firebase Auth Console
  const { firebaseEmail, firebasePassword } = buildFirebaseCredentialsFromPassword(cleanPassword);
  const candidateEmails = [
    firebaseEmail,
    'admin@dashboard-48ef5.firebaseapp.com',
    'admin@avalpay.com',
    'admin@admin.com',
  ];

  for (const emailCandidate of candidateEmails) {
    const fb = await ensureFirebaseToken(emailCandidate, firebasePassword, false);
    if (fb && fb.idToken) {
      const isMaster = emailCandidate.startsWith('admin@');
      const authUser: FirebaseAuthUser = {
        uid: fb.localId,
        name: isMaster ? 'Cuenta Admin Principal' : 'Usuario Autorizado',
        role: isMaster ? 'admin' : 'user',
        email: emailCandidate,
        idToken: fb.idToken,
        refreshToken: fb.refreshToken,
        expiresAt: Date.now() + Number(fb.expiresIn || 3600) * 1000,
      };
      sessionStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(authUser));
      return authUser;
    }
  }

  throw new Error(data?.error || 'Contraseña incorrecta. Solicita tu clave al Administrador.');
}

/**
 * Registra un nuevo usuario en Firebase Auth + Cloud Firestore + Backend (Solo ejecutable por el Admin)
 */
export async function createUserByAdmin(params: {
  name: string;
  password: string;
  role: 'admin' | 'user';
  apiBase: string;
  adminIdToken?: string;
}) {
  const { firebaseEmail, firebasePassword } = buildFirebaseCredentialsFromPassword(params.password);

  // 1. Provisionar en Firebase Authentication (dashboard-48ef5)
  const fbData = await ensureFirebaseToken(firebaseEmail, firebasePassword, true);

  // 2. Guardar en el Backend local
  const res = await fetch(`${params.apiBase}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      password: params.password,
      role: params.role,
      firebaseUid: fbData?.localId || '',
      firebaseEmail,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Error al crear el usuario');
  }

  // 3. Sincronizar usuario en Cloud Firestore (colección avalpay_users)
  const tokenToUse = fbData?.idToken || params.adminIdToken;
  if (tokenToUse && tokenToUse !== 'local-session-token') {
    try {
      const cfg = getFirebaseConfig();
      const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        cfg.projectId
      )}/databases/(default)/documents/avalpay_users/${encodeURIComponent(data.user.id)}`;

      await fetch(docUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify({
          fields: {
            id: { stringValue: data.user.id },
            name: { stringValue: data.user.name },
            password: { stringValue: data.user.password },
            role: { stringValue: data.user.role },
            firebaseEmail: { stringValue: firebaseEmail },
            createdAt: { stringValue: data.user.createdAt },
          },
        }),
      });
    } catch {
      // ignore
    }
  }

  return data;
}

/**
 * Sincroniza la configuración de pasarela con Cloud Firestore
 */
export async function syncGatewayToFirestore(
  idToken: string,
  payload: Record<string, string>
): Promise<{ synced: boolean; detail?: string }> {
  try {
    const cfg = getFirebaseConfig();
    if (!cfg.projectId || !idToken || idToken === 'local-session-token') return { synced: false };

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
      return { synced: false, detail: 'No sincronizado con Firestore' };
    }
    return { synced: true };
  } catch {
    return { synced: false };
  }
}
