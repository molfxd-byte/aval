import headerLogo from '@/assets/images/Pasarela/aval-pay-grupo-white.png';
import iconTitular from '@/assets/images/Pasarela/icon-titular2x.png';
import iconPay from '@/assets/images/Pasarela/icon-pay2x.png';
import iconCall from '@/assets/images/Pasarela/icon-callclient2x.png';
import productFrame from '@/assets/images/Pasarela/product-data-frame.png';
import iconCamera from '@/assets/images/Pasarela/icon-camera.png';
import iconAval from '@/assets/images/Pasarela/favicon-aval-gris-claro.svg';
import iconAvalActive from '@/assets/images/Pasarela/favicon-aval-azul-claro.svg';
import iconBanks from '@/assets/images/Pasarela/icon-banks.png';
import iconBanksActive from '@/assets/images/Pasarela/icon-banks-hover.png';
import iconExpand from '@/assets/images/Pasarela/icon-expand.png';
import bgMain from '@/assets/images/Pasarela/bg-main.png';
import logoNorton from '@/assets/images/Pasarela/logo-norton.png';
import logoSecure from '@/assets/images/Pasarela/logo-secure-trust.png';
import logoPse from '@/assets/images/Pasarela/logo-pse2x.png';
import iconInfo from '@/assets/images/Pasarela/icon-trailing-yellow.png';
import bankBogota from '@/assets/images/Pasarela/logo-v-banco-bogota.svg';
import bankOccidente from '@/assets/images/Pasarela/logo-v-banco-occidente.svg';
import bankPopular from '@/assets/images/Pasarela/logo-v-banco-popular.png';
import bankAvVillas from '@/assets/images/Pasarela/logo-v-banco-avvillas.svg';

export const pasarelaAssets = {
  headerLogo,
  iconTitular,
  iconPay,
  iconCall,
  productFrame,
  iconCamera,
  iconAval,
  iconAvalActive,
  iconBanks,
  iconBanksActive,
  iconExpand,
  iconInfo,
  logoPse,
  bgMain,
  logoNorton,
  logoSecure,
};

export const pasarelaDocumentTypes = [
  'Cédula de ciudadania',
  'Cédula de Extranjería',
  'NIT',
  'Tarjeta de Identidad',
  'Pasaporte',
  'Registro Civil',
];

export const pasarelaCountries = ['Colombia', 'Otros Países'];

export const pasarelaAvalBanks = [
  { id: 'BOGOTA', name: 'Banco de Bogotá', logo: bankBogota },
  { id: 'OCCIDENTE', name: 'Banco de Occidente', logo: bankOccidente },
  { id: 'POPULAR', name: 'Banco Popular', logo: bankPopular },
  { id: 'VILLAS', name: 'Banco AV Villas', logo: bankAvVillas },
];

export const pasarelaPseBanks = [
  'BANCO DAVIVIENDA',
  'BANCOLOMBIA',
  'DAVIPLATA',
  'NEQUI',
  'ACCION FIDUCIARIA',
  'ALIANZA FIDUCIARIA',
  'BAN100',
  'BANCAMIA S.A.',
  'BANCO AGRARIO',
  'BANCO AV VILLAS',
  'BANCO BBVA COLOMBIA S.A.',
  'BANCO CAJA SOCIAL',
  'BANCO CONTACTAR',
  'BANCO COOPERATIVO COOPCENTRAL',
  'BANCO DE BOGOTA',
  'BANCO DE OCCIDENTE',
  'BANCO FALABELLA',
  'BANCO FINANDINA S.A. BIC',
  'BANCO GNB SUDAMERIS',
  'BANCO ITAU',
  'BANCO J.P. MORGAN COLOMBIA S.A.',
  'BANCO MUNDO MUJER S.A.',
  'BANCO PICHINCHA S.A.',
  'BANCO POPULAR',
  'BANCO SANTANDER COLOMBIA',
  'BANCO SERFINANZA',
  'BANCO UNION',
  'BANCOOMEVA S.A.',
  'BCC ALIADOS',
  'BOLD CF',
  'CFA COOPERATIVA FINANCIERA',
  'CITIBANK',
  'COINK SA',
  'COLTEFINANCIERA',
  'CONFIAR COOPERATIVA FINANCIERA',
  'COTRAFA',
  'CREZCAMOS',
  'DALE',
  'DAVIbank red autorizada Davivienda',
  'DING',
  'FINANCIERA JURISCOOP SA COMPAÑIA DE FINANCIAMIENTO',
  'GLOBAL66',
  'IRIS',
  'JFK COOPERATIVA FINANCIERA',
  'LULO BANK',
  'MOVII S.A.',
  'NU',
  'PAYCASH',
  'POWWI',
  'UALA',
];

export const pasarelaPersonTypes = [
  { id: 'JURIDICA', label: 'Persona Jurídica' },
  { id: 'NATURAL', label: 'Persona Natural' },
];

export const PASARELA_SESSION_KEY = 'avalpay-pasarela-session';

export interface PasarelaReference {
  label: string;
  value: string;
}

export interface PasarelaSession {
  serviceName: string;
  logo?: string;
  amount: string;
  references: PasarelaReference[];
  detail?: string;
  method: 'aval' | 'pse';
  backTo: string;
  agreementId: string;
  transactionId: string;
}

export function savePasarelaSession(session: PasarelaSession) {
  sessionStorage.setItem(PASARELA_SESSION_KEY, JSON.stringify(session));
}

export function loadPasarelaSession(): PasarelaSession | null {
  try {
    const raw = sessionStorage.getItem(PASARELA_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PasarelaSession;
  } catch {
    return null;
  }
}

export function clearPasarelaSession() {
  sessionStorage.removeItem(PASARELA_SESSION_KEY);
}

export function formatPasarelaMoney(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '$0';
  return `$${Number(digits).toLocaleString('es-CO')}`;
}

export const PASARELA_REDIRECT_URL =
  import.meta.env.VITE_PAYMENT_REDIRECT_URL || 'https://linkdepagospse.rappipay.co/RFZZdd';

export function createTransactionId() {
  const now = Date.now().toString();
  return `AP${now.slice(-12)}`;
}
