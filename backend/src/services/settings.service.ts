import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

export type GatewayProvider = 'rappipay' | 'bold_api' | 'bold';

export interface GatewaySettings {
  gatewayProvider: GatewayProvider;
  paymentUrl: string;
  rappiUrl: string;
  boldUrl: string;
  boldApiKey: string;
  boldSecretKey: string;
  boldMerchantName: string;
  proxyHost: string;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  referenceId?: string;
  sessionId: string;
  nombre: string;
  doc: string;
  banco: string;
  monto: number;
  gateway: GatewayProvider;
  status: 'INITIATED' | 'PROCESSING' | 'GENERATED' | 'APPROVED' | 'REJECTED' | 'ERROR';
  redirectUrl?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'gateway-settings.json');
const TX_FILE = path.join(DATA_DIR, 'transactions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POOL_FILE = path.join(DATA_DIR, 'rappi-pool.json');
const LINK_LOGS_FILE = path.join(DATA_DIR, 'link-logs.json');

export interface RappiLinkItem {
  id: string;
  url: string;
  linkCode: string;
  status: 'ACTIVE' | 'STANDBY' | 'BLOCKED';
  usesCount: number;
  addedAt: string;
  blockedAt?: string;
  blockReason?: string;
}

export interface LinkEventLog {
  id: string;
  type: 'BLOCKED' | 'ROTATED' | 'ADDED' | 'TEST_OK' | 'TEST_FAIL';
  gateway: GatewayProvider;
  url: string;
  nextUrl?: string;
  reason: string;
  activeRemaining: number;
  blockedTotal: number;
  createdAt: string;
}

export interface PanelUser {
  id: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  firebaseUid?: string;
  firebaseEmail?: string;
  createdAt: string;
  lastLoginAt?: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function detectGatewayFromUrl(rawUrl: string): {
  detected: 'rappipay' | 'bold' | 'unknown';
  linkId: string;
  cleanUrl: string;
} {
  const cleanUrl = (rawUrl || '').trim();
  if (!cleanUrl) {
    return { detected: 'unknown', linkId: '', cleanUrl: '' };
  }

  const lower = cleanUrl.toLowerCase();
  if (lower.includes('rappipay.co')) {
    const parts = cleanUrl.split('/').filter(Boolean);
    const linkId = parts[parts.length - 1] || '';
    return { detected: 'rappipay', linkId, cleanUrl };
  }

  if (lower.includes('bold.co')) {
    const match = cleanUrl.match(/(LNK_[A-Z0-9]+)/i);
    const parts = cleanUrl.split('/').filter(Boolean);
    const linkId = match ? match[1] : parts[parts.length - 1] || '';
    return { detected: 'bold', linkId, cleanUrl };
  }

  return { detected: 'unknown', linkId: '', cleanUrl };
}

function getDefaultSettings(): GatewaySettings {
  const initialProvider = (env.paymentGatewayProvider || 'rappipay').toLowerCase();
  let gatewayProvider: GatewayProvider = 'rappipay';
  if (initialProvider === 'bold_api' || initialProvider === 'bold-api' || initialProvider === 'boldapi') {
    gatewayProvider = 'bold_api';
  } else if (initialProvider === 'bold') {
    gatewayProvider = 'bold';
  } else {
    gatewayProvider = 'rappipay';
  }

  const rappiUrl = env.paymentAutomationUrl || 'https://linkdepagospse.rappipay.co/v9eMyD';
  const boldUrl = env.boldDefaultLink || env.paymentBoldUrl || 'https://checkout.bold.co/payment/LNK_Z0PMCC30MQ';
  const paymentUrl = gatewayProvider === 'rappipay' ? rappiUrl : boldUrl;

  return {
    gatewayProvider,
    paymentUrl,
    rappiUrl,
    boldUrl,
    boldApiKey: env.boldApiKey || '1hj2O6y_2u3m0TOdk10irBoNdbpnBbLF3irryapeePU',
    boldSecretKey: env.boldSecretKey || 'XIhz1m8PhObmGYf47He-4A',
    boldMerchantName: 'Paycenter',
    proxyHost: env.proxyHost || 'geo.iproyal.com',
    proxyPort: env.proxyPort || '12321',
    proxyUsername: env.proxyUsername || 'WeeIuCAK2zva54rU',
    proxyPassword: env.proxyPassword || 'Z4VVsSB4GPzVOAqi_country-co',
    updatedAt: new Date().toISOString(),
  };
}

let cachedSettings: GatewaySettings | null = null;
let cachedTransactions: TransactionRecord[] | null = null;

export function getGatewaySettings(): GatewaySettings {
  if (cachedSettings) return cachedSettings;

  ensureDataDir();
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<GatewaySettings>;
      cachedSettings = { ...getDefaultSettings(), ...parsed };
      return cachedSettings;
    } catch (err) {
      console.error('[Settings] Error leyendo gateway-settings.json, usando valores por defecto:', err);
    }
  }

  cachedSettings = getDefaultSettings();
  return cachedSettings;
}

export function updateGatewaySettings(patch: Partial<GatewaySettings>): GatewaySettings {
  const current = getGatewaySettings();
  const next: GatewaySettings = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  // Auto-sincronizar URLs específicas cuando se envía paymentUrl
  if (patch.paymentUrl) {
    const info = detectGatewayFromUrl(patch.paymentUrl);
    if (info.detected === 'rappipay') {
      next.rappiUrl = info.cleanUrl;
      if (!patch.gatewayProvider) {
        next.gatewayProvider = 'rappipay';
      }
    } else if (info.detected === 'bold') {
      next.boldUrl = info.cleanUrl;
      if (!patch.gatewayProvider) {
        // Si tiene API key válida, usar bold_api por defecto, sino bold scrapper
        next.gatewayProvider = next.boldApiKey && next.boldApiKey.length >= 30 ? 'bold_api' : 'bold';
      }
    }
  }

  // Asegurar que paymentUrl refleje la pasarela seleccionada
  if (next.gatewayProvider === 'rappipay') {
    next.paymentUrl = next.rappiUrl || next.paymentUrl;
  } else {
    next.paymentUrl = next.boldUrl || next.paymentUrl;
  }

  ensureDataDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  cachedSettings = next;
  console.log(`[Settings] Configuración actualizada -> Pasarela: ${next.gatewayProvider.toUpperCase()} | URL: ${next.paymentUrl}`);
  return next;
}

export function getTransactions(): TransactionRecord[] {
  ensureDataDir();
  if (fs.existsSync(TX_FILE)) {
    try {
      const raw = fs.readFileSync(TX_FILE, 'utf-8');
      cachedTransactions = JSON.parse(raw) as TransactionRecord[];
      return cachedTransactions;
    } catch {
      cachedTransactions = [];
      return cachedTransactions;
    }
  }
  cachedTransactions = [];
  return cachedTransactions;
}

export function recordTransaction(tx: Omit<TransactionRecord, 'id' | 'createdAt'>): TransactionRecord {
  const list = getTransactions();
  const item: TransactionRecord = {
    ...tx,
    id: `TX_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  if (list.length > 200) {
    list.length = 200;
  }
  ensureDataDir();
  try {
    fs.writeFileSync(TX_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {
    // ignore disk errors
  }
  return item;
}

export function updateTransactionStatus(
  referenceOrId: string,
  status: TransactionRecord['status'],
  extra?: Partial<TransactionRecord>
): void {
  const list = getTransactions();
  const found = list.find(
    (t) => t.referenceId === referenceOrId || t.id === referenceOrId || t.sessionId === referenceOrId
  );
  if (found) {
    found.status = status;
    if (status === 'APPROVED') {
      found.confirmedAt = new Date().toISOString();
    }
    if (extra) {
      Object.assign(found, extra);
    }
    ensureDataDir();
    try {
      fs.writeFileSync(TX_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }
}

let cachedUsers: PanelUser[] | null = null;

function getDefaultUsers(): PanelUser[] {
  return [
    {
      id: 'USR_MASTER_ADMIN',
      name: 'Cuenta Admin Principal',
      password: process.env.ADMIN_MASTER_PASSWORD || 'admin2026',
      role: 'admin',
      firebaseEmail: 'admin@dashboard-48ef5.firebaseapp.com',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function getPanelUsers(): PanelUser[] {
  if (cachedUsers) return cachedUsers;
  ensureDataDir();
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PanelUser[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedUsers = parsed;
        return cachedUsers;
      }
    } catch {
      // ignore
    }
  }
  const initial = getDefaultUsers();
  fs.writeFileSync(USERS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  cachedUsers = initial;
  return cachedUsers;
}

export function findUserByPassword(password: string): PanelUser | null {
  const clean = (password || '').trim();
  if (!clean) return null;
  const users = getPanelUsers();
  const found = users.find((u) => u.password === clean);
  if (found) {
    found.lastLoginAt = new Date().toISOString();
    ensureDataDir();
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch {
      // ignore
    }
    return found;
  }
  return null;
}

export function createPanelUser(data: {
  name: string;
  password: string;
  role?: 'admin' | 'user';
  firebaseUid?: string;
  firebaseEmail?: string;
}): PanelUser {
  const name = (data.name || '').trim();
  const password = (data.password || '').trim();
  if (!name || !password) {
    throw new Error('Debes indicar el nombre del usuario y la contraseña.');
  }

  const users = getPanelUsers();
  if (users.some((u) => u.password === password)) {
    throw new Error('Esa contraseña ya está asignada a otro usuario.');
  }

  const newUser: PanelUser = {
    id: `USR_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name,
    password,
    role: data.role === 'admin' ? 'admin' : 'user',
    firebaseUid: data.firebaseUid,
    firebaseEmail: data.firebaseEmail,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  cachedUsers = users;
  return newUser;
}

export function updatePanelUserPassword(id: string, newPassword: string, newName?: string): PanelUser {
  const cleanPass = (newPassword || '').trim();
  if (!cleanPass) {
    throw new Error('La nueva contraseña no puede estar vacía.');
  }
  const users = getPanelUsers();
  const duplicate = users.find((u) => u.password === cleanPass && u.id !== id);
  if (duplicate) {
    throw new Error('Esa contraseña ya está en uso por otro usuario.');
  }
  const target = users.find((u) => u.id === id);
  if (!target) {
    throw new Error('Usuario no encontrado.');
  }
  target.password = cleanPass;
  if (newName && newName.trim()) {
    target.name = newName.trim();
  }
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  cachedUsers = users;
  return target;
}

export function deletePanelUser(id: string): void {
  const users = getPanelUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;
  if (target.id === 'USR_MASTER_ADMIN') {
    throw new Error('No se puede eliminar la Cuenta Admin Principal (solo cambiar su contraseña).');
  }
  const filtered = users.filter((u) => u.id !== id);
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  cachedUsers = filtered;
}

// ==================== RAPPIPAY POOL & AUTO-ROTATION ====================
let cachedPool: RappiLinkItem[] | null = null;
let cachedLinkLogs: LinkEventLog[] | null = null;

export function getRappiLinksPool(): RappiLinkItem[] {
  if (cachedPool) return cachedPool;
  ensureDataDir();
  if (fs.existsSync(POOL_FILE)) {
    try {
      const raw = fs.readFileSync(POOL_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as RappiLinkItem[];
      if (Array.isArray(parsed)) {
        cachedPool = parsed;
        return cachedPool;
      }
    } catch {
      // ignore
    }
  }
  const current = getGatewaySettings();
  const initialInfo = detectGatewayFromUrl(current.rappiUrl);
  const initialPool: RappiLinkItem[] = current.rappiUrl
    ? [
        {
          id: `RPL_${Date.now()}`,
          url: current.rappiUrl,
          linkCode: initialInfo.linkId || 'rappi',
          status: 'ACTIVE',
          usesCount: 0,
          addedAt: new Date().toISOString(),
        },
      ]
    : [];
  fs.writeFileSync(POOL_FILE, JSON.stringify(initialPool, null, 2), 'utf-8');
  cachedPool = initialPool;
  return cachedPool;
}

function saveRappiPool(pool: RappiLinkItem[]): void {
  ensureDataDir();
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2), 'utf-8');
  cachedPool = pool;
}

export function getPoolSummary() {
  const pool = getRappiLinksPool();
  const activeItem = pool.find((p) => p.status === 'ACTIVE');
  const standbyCount = pool.filter((p) => p.status === 'STANDBY').length;
  const blockedCount = pool.filter((p) => p.status === 'BLOCKED').length;
  const activeTotal = (activeItem ? 1 : 0) + standbyCount;
  return {
    activeUrl: activeItem?.url || null,
    activeTotal,
    standbyCount,
    blockedCount,
    totalInPool: pool.length,
  };
}

export function getLinkLogs(): LinkEventLog[] {
  if (cachedLinkLogs) return cachedLinkLogs;
  ensureDataDir();
  if (fs.existsSync(LINK_LOGS_FILE)) {
    try {
      const raw = fs.readFileSync(LINK_LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as LinkEventLog[];
      if (Array.isArray(parsed)) {
        cachedLinkLogs = parsed;
        return cachedLinkLogs;
      }
    } catch {
      // ignore
    }
  }
  cachedLinkLogs = [];
  return cachedLinkLogs;
}

export function recordLinkEvent(
  event: Omit<LinkEventLog, 'id' | 'createdAt' | 'activeRemaining' | 'blockedTotal'>
): LinkEventLog {
  const logs = getLinkLogs();
  const summary = getPoolSummary();
  const entry: LinkEventLog = {
    ...event,
    id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    activeRemaining: summary.activeTotal,
    blockedTotal: summary.blockedCount,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(entry);
  if (logs.length > 150) logs.length = 150;
  ensureDataDir();
  try {
    fs.writeFileSync(LINK_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch {
    // ignore
  }
  cachedLinkLogs = logs;
  return entry;
}

export function addRappiLinksToPool(rawUrls: string[]): RappiLinkItem[] {
  const pool = getRappiLinksPool();
  let hasActive = pool.some((p) => p.status === 'ACTIVE');

  for (const raw of rawUrls) {
    const clean = (raw || '').trim();
    if (!clean) continue;
    const info = detectGatewayFromUrl(clean);
    const existing = pool.find((p) => p.url.toLowerCase() === clean.toLowerCase());
    if (existing) {
      // Si estaba bloqueado y lo vuelve a subir o reactivar
      if (existing.status === 'BLOCKED') {
        existing.status = hasActive ? 'STANDBY' : 'ACTIVE';
        existing.blockedAt = undefined;
        existing.blockReason = undefined;
        if (existing.status === 'ACTIVE') hasActive = true;
      }
      continue;
    }

    const status: RappiLinkItem['status'] = hasActive ? 'STANDBY' : 'ACTIVE';
    if (status === 'ACTIVE') hasActive = true;

    pool.push({
      id: `RPL_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      url: clean,
      linkCode: info.linkId || clean.split('/').pop() || 'link',
      status,
      usesCount: 0,
      addedAt: new Date().toISOString(),
    });
  }

  saveRappiPool(pool);

  const activeNow = pool.find((p) => p.status === 'ACTIVE');
  if (activeNow) {
    updateGatewaySettings({ rappiUrl: activeNow.url, paymentUrl: activeNow.url });
  }

  return pool;
}

export function activateRappiLinkInPool(idOrUrl: string): RappiLinkItem[] {
  const pool = getRappiLinksPool();
  const target = pool.find((p) => p.id === idOrUrl || p.url === idOrUrl);
  if (!target) {
    throw new Error('Link no encontrado en el pool.');
  }

  for (const item of pool) {
    if (item.id === target.id) {
      item.status = 'ACTIVE';
      item.blockedAt = undefined;
      item.blockReason = undefined;
    } else if (item.status === 'ACTIVE') {
      item.status = 'STANDBY';
    }
  }

  saveRappiPool(pool);
  updateGatewaySettings({ gatewayProvider: 'rappipay', rappiUrl: target.url, paymentUrl: target.url });
  return pool;
}

export function removeRappiLinkFromPool(idOrUrl: string): RappiLinkItem[] {
  let pool = getRappiLinksPool();
  const target = pool.find((p) => p.id === idOrUrl || p.url === idOrUrl);
  pool = pool.filter((p) => p.id !== idOrUrl && p.url !== idOrUrl);

  if (target?.status === 'ACTIVE') {
    const nextStandby = pool.find((p) => p.status === 'STANDBY');
    if (nextStandby) {
      nextStandby.status = 'ACTIVE';
      updateGatewaySettings({ rappiUrl: nextStandby.url, paymentUrl: nextStandby.url });
    }
  }

  saveRappiPool(pool);
  return pool;
}

export function incrementRappiLinkUse(url: string): void {
  const pool = getRappiLinksPool();
  const found = pool.find((p) => p.url.toLowerCase() === (url || '').trim().toLowerCase());
  if (found) {
    found.usesCount = (found.usesCount || 0) + 1;
    saveRappiPool(pool);
  }
}

export function markLinkBlockedAndRotate(
  blockedUrl: string,
  reason: string,
  gateway: GatewayProvider = 'rappipay'
): {
  rotatedTo: string | null;
  activeRemaining: number;
  blockedTotal: number;
  logEntry: LinkEventLog;
} {
  const cleanBlocked = (blockedUrl || '').trim();
  const pool = getRappiLinksPool();

  if (gateway === 'rappipay') {
    let target = pool.find((p) => p.url.toLowerCase() === cleanBlocked.toLowerCase());
    if (!target && cleanBlocked) {
      const info = detectGatewayFromUrl(cleanBlocked);
      target = {
        id: `RPL_${Date.now()}`,
        url: cleanBlocked,
        linkCode: info.linkId || 'rappi',
        status: 'BLOCKED',
        usesCount: 1,
        addedAt: new Date().toISOString(),
      };
      pool.push(target);
    }
    if (target) {
      target.status = 'BLOCKED';
      target.blockedAt = new Date().toISOString();
      target.blockReason = reason;
    }

    // Buscar siguiente link STANDBY o ACTIVE distinto al bloqueado
    const nextCandidate = pool.find(
      (p) => (p.status === 'STANDBY' || p.status === 'ACTIVE') && p.url.toLowerCase() !== cleanBlocked.toLowerCase()
    );

    let rotatedTo: string | null = null;
    if (nextCandidate) {
      for (const item of pool) {
        if (item.id === nextCandidate.id) {
          item.status = 'ACTIVE';
        } else if (item.status === 'ACTIVE') {
          item.status = 'STANDBY';
        }
      }
      rotatedTo = nextCandidate.url;
      updateGatewaySettings({
        gatewayProvider: 'rappipay',
        rappiUrl: rotatedTo,
        paymentUrl: rotatedTo,
      });
    }

    saveRappiPool(pool);
    const summary = getPoolSummary();
    const logEntry = recordLinkEvent({
      type: rotatedTo ? 'ROTATED' : 'BLOCKED',
      gateway,
      url: cleanBlocked,
      nextUrl: rotatedTo || undefined,
      reason,
    });

    return {
      rotatedTo,
      activeRemaining: summary.activeTotal,
      blockedTotal: summary.blockedCount,
      logEntry,
    };
  }

  // Si es Bold
  const summary = getPoolSummary();
  const logEntry = recordLinkEvent({
    type: 'BLOCKED',
    gateway,
    url: cleanBlocked,
    reason,
  });

  return {
    rotatedTo: null,
    activeRemaining: summary.activeTotal,
    blockedTotal: summary.blockedCount + 1,
    logEntry,
  };
}



