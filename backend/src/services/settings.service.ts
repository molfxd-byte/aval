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
  status: 'GENERATED' | 'APPROVED' | 'REJECTED' | 'ERROR';
  redirectUrl?: string;
  errorMessage?: string;
  createdAt: string;
  confirmedAt?: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'gateway-settings.json');
const TX_FILE = path.join(DATA_DIR, 'transactions.json');

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
  const found = list.find((t) => t.referenceId === referenceOrId || t.id === referenceOrId);
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

