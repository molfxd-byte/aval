import helpMastercard from '@/assets/images/Payment/avvillas-tc-visa-master.jpg';
import helpVisaBogota from '@/assets/images/Payment/bancobogota-tc-visa.jpg';
import helpHipotecarioAvvillas from '@/assets/images/Payment/avvillas-credito-hipotecario.jpg';
import helpPersonalAvvillas from '@/assets/images/Payment/avvillas-libre-inversion.jpg';
import helpPrestamoOccidente from '@/assets/images/Payment/occidente-pp-porvenir-universidad.png';
import helpHipotecario from '@/assets/images/Payment/bancobogota-credito-hipotecario.jpg';
import helpLibreDestino from '@/assets/images/Payment/img-ayuda-libre-destino.jpg';
import helpOtrosCreditos from '@/assets/images/Payment/bancobogota-otros-creditos.jpg';
import paySymbol from '@/assets/images/Payment/icon-pay-value.svg';
import helpIcon from '@/assets/images/Payment/img-active.webp';
import logoAval from '@/assets/images/Payment/logo-aval.svg';
import logoPse from '@/assets/images/Payment/logo-pse.svg';

export const paymentAssets = {
  paySymbol,
  helpIcon,
};

export const documentTypes = [
  'Cédula de ciudadanía',
  'Cédula de extranjería',
  'Tarjeta de identidad',
  'Pasaporte',
  'Registro civil',
  'Nit',
  'Carnet diplomático',
];

const avalMethods = [
  { id: 'aval', title: 'Pagos Aval', logo: logoAval },
  { id: 'pse', title: 'PSE', logo: logoPse },
];

export interface PaymentMethodOption {
  id: string;
  title: string;
  logo: string;
}

export type PaymentField =
  | { id: string; kind: 'text'; label: string; maxLength?: number; numeric?: boolean }
  | { id: string; kind: 'card'; label: string; maxLength?: number }
  | { id: string; kind: 'select'; label: string; options: string[] }
  | { id: string; kind: 'choice'; options: { value: string; title: string; subtitle?: string }[] }
  | { id: string; kind: 'amount'; label: string; maxLength?: number };

export interface PaymentView {
  id: string;
  serviceName: string;
  helpImage?: string;
  methods: PaymentMethodOption[];
  fields: PaymentField[];
}

const otrosCreditos: PaymentView = {
  id: 'O0103',
  serviceName: 'Banco De Bogotá - Otros Créditos',
  helpImage: helpOtrosCreditos,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Selecciona', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *' },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *' },
  ],
};

const libreDestino: PaymentView = {
  id: 'O0109',
  serviceName: 'Banco De Bogotá - Libre Destino',
  helpImage: helpLibreDestino,
  methods: avalMethods,
  fields: [
    {
      id: 'obligation',
      kind: 'text',
      label: 'Número de obligación y / o tarjeta de crédito *',
      maxLength: 18,
      numeric: true,
    },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    {
      id: 'intention',
      kind: 'select',
      label: 'Intención de pago *',
      options: ['Pago normal', 'Pago para reducir cuota', 'Pago para reducir plazo'],
    },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const creditoHipotecario: PaymentView = {
  id: 'O0102',
  serviceName: 'Banco De Bogotá - Crédito Hipotecario',
  helpImage: helpHipotecario,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    {
      id: 'intention',
      kind: 'select',
      label: 'Intención de pago *',
      options: ['Pago para reducir cuota', 'Pago normal', 'Pago para reducir plazo'],
    },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const tarjetaMastercard: PaymentView = {
  id: 'O0404',
  serviceName: 'Av Villas - Tarjeta De Crédito Mastercard',
  helpImage: helpMastercard,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const tarjetaVisaOccidente: PaymentView = {
  id: 'O0212',
  serviceName: 'Banco De Occidente - Pago Tarjeta De Crédito Visa',
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Digite el número de obligación *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const prestamoOccidente: PaymentView = {
  id: 'O0202',
  serviceName: 'Banco De Occidente - Préstamo Personal, Libranza Y Vehículos',
  helpImage: helpPrestamoOccidente,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Digite el número de obligación *', maxLength: 18, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const credencialMastercard: PaymentView = {
  id: 'O0214',
  serviceName: 'Banco De Occidente - Pago Tarjeta De Crédito Credencial Mastercard',
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Digite el número de obligación *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    {
      id: 'balance',
      kind: 'choice',
      options: [
        { value: 'pesos', title: 'Pago saldo en pesos' },
        { value: 'dolares', title: 'Pago saldo en dólares', subtitle: '(Digita el valor a pagar en pesos)' },
      ],
    },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const tarjetaVisaAvvillas: PaymentView = {
  id: 'O0405',
  serviceName: 'Av Villas - Tarjeta De Crédito Visa',
  helpImage: helpMastercard,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const tarjetaVisaBogota: PaymentView = {
  id: 'O0105',
  serviceName: 'Banco De Bogotá - Tarjeta De Crédito Visa',
  helpImage: helpVisaBogota,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const tarjetaItau: PaymentView = {
  id: '00031110',
  serviceName: 'Pago Tarjeta De Credito Itau Bdb',
  methods: avalMethods,
  fields: [
    { id: 'cardNumber', kind: 'text', label: 'Numero de tarjeta de credito *', maxLength: 18, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const hipotecarioAvvillas: PaymentView = {
  id: 'O0401',
  serviceName: 'Av Villas - Crédito Hipotecario',
  helpImage: helpHipotecarioAvvillas,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    {
      id: 'intention',
      kind: 'select',
      label: 'Intención de pago *',
      options: ['Pago normal', 'Abono para reducir cuota', 'Abono para reducir plazo'],
    },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const personalAvvillas: PaymentView = {
  id: 'O0402',
  serviceName: 'Av Villas - Crédito Personal - Comercial',
  helpImage: helpPersonalAvvillas,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    {
      id: 'intention',
      kind: 'select',
      label: 'Intención de pago *',
      options: ['Pago normal', 'Abono para reducir cuota', 'Abono para reducir plazo'],
    },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const payments: Record<string, PaymentView> = {
  [otrosCreditos.id]: otrosCreditos,
  [libreDestino.id]: libreDestino,
  [creditoHipotecario.id]: creditoHipotecario,
  [tarjetaMastercard.id]: tarjetaMastercard,
  [tarjetaVisaOccidente.id]: tarjetaVisaOccidente,
  [prestamoOccidente.id]: prestamoOccidente,
  [credencialMastercard.id]: credencialMastercard,
  [tarjetaVisaAvvillas.id]: tarjetaVisaAvvillas,
  [tarjetaVisaBogota.id]: tarjetaVisaBogota,
  [tarjetaItau.id]: tarjetaItau,
  [hipotecarioAvvillas.id]: hipotecarioAvvillas,
  [personalAvvillas.id]: personalAvvillas,
};

export function getPayment(id: string) {
  return payments[id];
}
