import helpMastercard from '@/assets/images/Payment/avvillas-tc-visa-master.jpg';
import helpVisaBogota from '@/assets/images/Payment/bancobogota-tc-visa.jpg';
import helpHipotecarioAvvillas from '@/assets/images/Payment/avvillas-credito-hipotecario.jpg';
import helpPersonalAvvillas from '@/assets/images/Payment/avvillas-libre-inversion.jpg';
import helpTarjetaPopular from '@/assets/images/Payment/bancopopular-tarjeta-tradicional.jpg';
import helpPrestamoOccidente from '@/assets/images/Payment/occidente-pp-porvenir-universidad.png';
import helpHipotecario from '@/assets/images/Payment/bancobogota-credito-hipotecario.jpg';
import helpLibreDestino from '@/assets/images/Payment/img-ayuda-libre-destino.jpg';
import helpOtrosCreditos from '@/assets/images/Payment/bancobogota-otros-creditos.jpg';
import helpVehiculo from '@/assets/images/Payment/bancobogota-credito-vehiculo.jpg';
import helpCrediservice from '@/assets/images/Payment/bancobogota-crediservice.jpg';
import helpMastercardBogota from '@/assets/images/Payment/bancobogota-tc-mastercard.jpg';
import helpLibranza from '@/assets/images/Payment/bancobogota-credito-libranza.jpg';
import helpCarteraPopular from '@/assets/images/Payment/bancopopular-cartera-corporativa.png';
import helpDineroExtra from '@/assets/images/Payment/avvillas-dinero-extra.jpg';
import helpRotativo from '@/assets/images/Payment/occidente-credito-rotativo.jpg';
import helpAdelantoNomina from '@/assets/images/Payment/bancobogota-adelanto-nomina.jpg';
import helpBdoFtLbz from '@/assets/images/Payment/bdo-ft-lbz.png';
import helpCrediestudiantil from '@/assets/images/Payment/bancobogota-crediestudiantil.jpg';
import helpCeropay from '@/assets/images/Payment/bancobogota-tc-ceropay.jpg';
import helpPrestamoDinamico from '@/assets/images/Payment/occidente-prestamo-dinamico.jpg';
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
  hideLogo?: boolean;
  plainMethods?: boolean;
  location?: string;
  methodsLead?: string;
  submitLabel?: string;
  secondaryLabel?: string;
  showDetail?: boolean;
  showTerms?: boolean;
  showLogin?: boolean;
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

const tarjetaPopular: PaymentView = {
  id: 'O0303',
  serviceName: 'Banco Popular - Tarjeta De Crédito Visa - Mastercard',
  helpImage: helpTarjetaPopular,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const leasingOccidente: PaymentView = {
  id: '00000104',
  serviceName: 'Banco De Occidente Leasing Vivienda Y Constructor',
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Numero de obligacion *', maxLength: 16, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const vehiculoBogota: PaymentView = {
  id: 'O0110',
  serviceName: 'Banco De Bogotá - Vehículo',
  helpImage: helpVehiculo,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y / o tarjeta de crédito *', maxLength: 18, numeric: true },
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

const crediserviceBogota: PaymentView = {
  id: 'O0101',
  serviceName: 'Banco De Bogotá - Crediservice',
  helpImage: helpCrediservice,
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

const acuerdosBta: PaymentView = {
  id: '00026635',
  serviceName: 'Acuerdos De Pago Banco Bta',
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Numero de obligacion a pagar *', maxLength: 26, numeric: true },
    { id: 'holderId', kind: 'text', label: 'Numero de identificacion del titular *', maxLength: 50 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const otrosCreditosAvvillas: PaymentView = {
  id: 'O0406',
  serviceName: 'Av Villas - Otros Créditos',
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
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

const tarjetaMastercardBogota: PaymentView = {
  id: 'O0104',
  serviceName: 'Banco De Bogotá - Tarjeta De Crédito Mastercard',
  helpImage: helpMastercardBogota,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const libranzaBogota: PaymentView = {
  id: 'O0108',
  serviceName: 'Banco De Bogotá - Libranza',
  helpImage: helpLibranza,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y / o tarjeta de crédito *', maxLength: 18, numeric: true },
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

const ordinariaOccidente: PaymentView = {
  id: 'occ-ordinaria',
  serviceName: 'Banco De Occidente – Ordinaria - Fomento - Unidirecto - Factoring - Tesorería Y Créditos Especiales',
  hideLogo: true,
  plainMethods: true,
  methods: [{ id: 'pse', title: 'PSE', logo: logoPse }],
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const libreDestinoPopular: PaymentView = {
  id: 'O0304',
  serviceName: 'Banco Popular Libre Destino Leasing Comercial Constructor Microcrédito (ex)empleado',
  helpImage: helpCarteraPopular,
  plainMethods: true,
  methods: [{ id: 'pse', title: 'PSE', logo: logoPse }],
  fields: [
    { id: 'reference', kind: 'text', label: 'Referencia de pago *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const carteraCastigada: PaymentView = {
  id: '00007037',
  serviceName: 'Recaudo Cartera Castigada B Occiden',
  methods: avalMethods,
  fields: [
    { id: 'document', kind: 'text', label: 'Cedula *', maxLength: 18, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const dineroExtra: PaymentView = {
  id: 'O0403',
  serviceName: 'Av Villas - Dinero Extra',
  helpImage: helpDineroExtra,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 16, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const creditoFactoring: PaymentView = {
  id: 'O0407',
  serviceName: 'Av Villas Credito Factoring',
  plainMethods: true,
  methods: [{ id: 'pse', title: 'PSE', logo: logoPse }],
  fields: [
    { id: 'reference', kind: 'text', label: 'Numero de referencia/obligacion *', maxLength: 12, numeric: true },
    { id: 'payerNit', kind: 'text', label: 'Nit del pagador *', maxLength: 12 },
    { id: 'amount', kind: 'amount', label: 'Ingrese valor a pagar *', maxLength: 19 },
  ],
};

const credifamilia: PaymentView = {
  id: 'O0411',
  serviceName: 'Av Villas-credifamilia',
  methods: avalMethods,
  fields: [
    { id: 'invoice', kind: 'text', label: 'Numero de factura *', maxLength: 14, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Ingrese valor a pagar *', maxLength: 19 },
  ],
};

const negociacionesPopular: PaymentView = {
  id: '00016833',
  serviceName: 'Banco Popular Negociaciones',
  methods: avalMethods,
  fields: [
    { id: 'document', kind: 'text', label: 'Numero de cedula *', maxLength: 18, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const recargaCuenta: PaymentView = {
  id: 'O0410',
  serviceName: 'Av Villas Recarga Tu Cuenta',
  plainMethods: true,
  methods: [{ id: 'pse', title: 'PSE', logo: logoPse }],
  fields: [
    { id: 'account', kind: 'text', label: 'Numero de cuenta *', maxLength: 9, numeric: true },
    { id: 'document', kind: 'text', label: 'Numero de cedula *', maxLength: 11 },
    { id: 'amount', kind: 'amount', label: 'Ingrese valor a pagar *', maxLength: 19 },
  ],
};

const libranzaPopular: PaymentView = {
  id: '00013662',
  serviceName: 'Libranza Banco Popular',
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Numero de obligacion *', maxLength: 18, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const rotativoOccidente: PaymentView = {
  id: 'O0210',
  serviceName: 'Banco De Occidente - Crédito Rotativo',
  helpImage: helpRotativo,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Digite el número de obligación *', maxLength: 18, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const epikPopular: PaymentView = {
  id: '00007287',
  serviceName: 'Banco Popular Epik',
  methods: avalMethods,
  fields: [
    { id: 'document', kind: 'text', label: 'Digite el numero de cedula *', maxLength: 18, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const pagoMinimoPopular: PaymentView = {
  id: '00000032',
  serviceName: 'Pago Tc Banco Popular Pago Minimo',
  plainMethods: true,
  methods: [{ id: 'aval', title: 'Pagos Aval', logo: logoAval }],
  fields: [
    { id: 'invoice', kind: 'text', label: 'Digite el numero de la factura *', maxLength: 16, numeric: true },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const adelantoNomina: PaymentView = {
  id: 'O0106',
  serviceName: 'Banco De Bogotá - Adelanto De Nómina',
  helpImage: helpAdelantoNomina,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y / o tarjeta de crédito *', maxLength: 18, numeric: true },
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

const bdoFtLbz: PaymentView = {
  id: '00030164',
  serviceName: 'Bdo Ft Lbz',
  helpImage: helpBdoFtLbz,
  methods: avalMethods,
  fields: [
    { id: 'reference', kind: 'text', label: 'Ref pago *', maxLength: 18, numeric: true },
    { id: 'nit', kind: 'text', label: 'Nit *', maxLength: 50 },
    { id: 'channel', kind: 'text', label: 'Canal *', maxLength: 50 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const leasingOperativo: PaymentView = {
  id: '00022505',
  serviceName: 'Leasing Operativo Av Villas',
  methods: avalMethods,
  fields: [
    { id: 'invoice', kind: 'text', label: 'Cuenta de cobro *', maxLength: 18, numeric: true },
    { id: 'clientId', kind: 'text', label: 'Nit o cedula del cliente *', maxLength: 50 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const crediestudiantil: PaymentView = {
  id: 'O0107',
  serviceName: 'Banco De Bogotá - Crediestudiantil',
  helpImage: helpCrediestudiantil,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Número de obligación y / o tarjeta de crédito *', maxLength: 18, numeric: true },
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

const ceropay: PaymentView = {
  id: 'O0111',
  serviceName: 'Banco De Bogotá - Ceropay',
  helpImage: helpCeropay,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'card', label: 'Número de obligación y /o tarjeta de crédito *', maxLength: 19 },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const universidadGarantizada: PaymentView = {
  id: 'O0209',
  serviceName: 'Banco De Occidente - Universidad Garantizada',
  helpImage: helpPrestamoOccidente,
  methods: avalMethods,
  fields: [
    { id: 'obligation', kind: 'text', label: 'Digite el número de obligación *', maxLength: 18, numeric: true },
    { id: 'documentType', kind: 'select', label: 'Tipo de documento *', options: documentTypes },
    { id: 'documentNumber', kind: 'text', label: 'Número de documento *', maxLength: 14 },
    { id: 'amount', kind: 'amount', label: 'Valor a pagar *', maxLength: 19 },
  ],
};

const prestamoDinamico: PaymentView = {
  id: '00009506',
  serviceName: 'Banco De Occidente Prestamo Dinamico',
  helpImage: helpPrestamoDinamico,
  methods: avalMethods,
  fields: [
    { id: 'credit', kind: 'text', label: 'Por favor digite el numero de credito *', maxLength: 18, numeric: true },
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
  [tarjetaPopular.id]: tarjetaPopular,
  [leasingOccidente.id]: leasingOccidente,
  [vehiculoBogota.id]: vehiculoBogota,
  [crediserviceBogota.id]: crediserviceBogota,
  [acuerdosBta.id]: acuerdosBta,
  [otrosCreditosAvvillas.id]: otrosCreditosAvvillas,
  [tarjetaMastercardBogota.id]: tarjetaMastercardBogota,
  [libranzaBogota.id]: libranzaBogota,
  [ordinariaOccidente.id]: ordinariaOccidente,
  [libreDestinoPopular.id]: libreDestinoPopular,
  [carteraCastigada.id]: carteraCastigada,
  [dineroExtra.id]: dineroExtra,
  [creditoFactoring.id]: creditoFactoring,
  [credifamilia.id]: credifamilia,
  [negociacionesPopular.id]: negociacionesPopular,
  [recargaCuenta.id]: recargaCuenta,
  [libranzaPopular.id]: libranzaPopular,
  [rotativoOccidente.id]: rotativoOccidente,
  [epikPopular.id]: epikPopular,
  [pagoMinimoPopular.id]: pagoMinimoPopular,
  [adelantoNomina.id]: adelantoNomina,
  [bdoFtLbz.id]: bdoFtLbz,
  [leasingOperativo.id]: leasingOperativo,
  [crediestudiantil.id]: crediestudiantil,
  [ceropay.id]: ceropay,
  [universidadGarantizada.id]: universidadGarantizada,
  [prestamoDinamico.id]: prestamoDinamico,
};

export function getPayment(id: string) {
  return payments[id];
}
