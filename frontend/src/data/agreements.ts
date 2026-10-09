import agreementLogo from '@/assets/images/Agreements/agreement-default.svg';
import chevronDown from '@/assets/images/Agreements/chevron-down.svg';
import pageSizeClosed from '@/assets/images/Agreements/closed.png';
import pageSizeOpen from '@/assets/images/Agreements/open.png';
import { images } from '@/assets/images';

export const agreementAssets = {
  logo: agreementLogo,
  hero: images.categoryCards,
  chevronDown,
  pageSizeClosed,
  pageSizeOpen,
};

export const obligacionesContent = {
  title: 'Obligaciones Aval',
  paragraph:
    'Por favor selecciona el servicio y posteriormente digita los datos solicitados para continuar con el proceso.',
  returnLabel: 'Volver',
  searchLabel: 'Escribe el nombre o código del convenio',
  searchButton: 'Buscar',
  departmentLabel: 'Departamento',
  departmentPlaceholder: 'Seleccionar',
  showLabel: 'Mostrar',
  payLabel: 'Pagar',
  enrollLabel: 'Inscribir',
  resultsOf: 'de',
  resultsLabel: 'resultados',
  emptyMessage: 'No se encontraron convenios en tu búsqueda.',
  floatingLabel: 'Realiza un pago',
  crumbs: [
    { label: 'Inicio', href: '/' },
    { label: '¿Qué quieres pagar hoy?', href: '/' },
    { label: 'Obligaciones Aval' },
  ],
};

export const pageSizeOptions = [10, 15, 20, 30];

export const departments = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlántico',
  'Bogotá',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Caquetá',
  'Casanare',
  'Cauca',
  'Cesar',
  'Choco',
  'Córdoba',
  'Cundinamarca',
  'Guainía',
  'Guaviare',
  'Huila',
  'La guajira',
  'Magdalena',
  'Meta',
  'Nariño',
  'Norte de Santander',
  'Putumayo',
  'Quindío',
  'Risaralda',
  'San Andres, providencia y Santa catalina',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupés',
  'Vichada',
];

const logoFiles = import.meta.glob('../assets/images/Agreements/logos/*.{png,jpg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function agreementLogoById(id: string) {
  const match = Object.entries(logoFiles).find(([path]) => path.includes(`/${id}.`));
  return match?.[1] ?? agreementLogo;
}

export interface Agreement {
  id: string;
  name: string;
  department: string;
  acceptsEnrollment: boolean;
  logo: string;
}

const convenio = (id: string, name: string, acceptsEnrollment = false): Agreement => ({
  id,
  name,
  department: '',
  acceptsEnrollment,
  logo: agreementLogoById(id),
});

export const obligacionesAgreements: Agreement[] = [
  convenio('O0103', 'BANCO DE BOGOTÁ - OTROS CRÉDITOS'),
  convenio('O0109', 'BANCO DE BOGOTÁ - LIBRE DESTINO'),
  convenio('O0102', 'BANCO DE BOGOTÁ - CRÉDITO HIPOTECARIO'),
  convenio('O0404', 'AV VILLAS - TARJETA DE CRÉDITO MASTERCARD'),
  convenio('O0212', 'BANCO DE OCCIDENTE - PAGO TARJETA DE CRÉDITO VISA'),
  convenio('O0202', 'Banco de Occidente - Prestamo Personal, Libranza y Vehiculos'),
  convenio('O0214', 'BANCO DE OCCIDENTE - PAGO TARJETA DE CRÉDITO CREDENCIAL MASTERCARD'),
  convenio('O0405', 'AV VILLAS - TARJETA DE CRÉDITO VISA'),
  convenio('O0105', 'BANCO DE BOGOTÁ - TARJETA DE CRÉDITO VISA'),
  convenio('00031110', 'PAGO TARJETA DE CREDITO ITAU BDB'),
  convenio('O0401', 'AV VILLAS - CRÉDITO HIPOTECARIO'),
  convenio('O0402', 'AV VILLAS - CRÉDITO PERSONAL - COMERCIAL'),
  convenio('O0303', 'BANCO POPULAR - TARJETA DE CRÉDITO VISA - MASTERCARD'),
  convenio('00000104', 'Banco de Occidente Leasing Vivienda y Constructor', true),
  convenio('O0110', 'BANCO DE BOGOTÁ - VEHÍCULO'),
  convenio('O0101', 'BANCO DE BOGOTÁ - CREDISERVICE'),
  convenio('00026635', 'Acuerdos de Pago Banco Bta', true),
  convenio('O0406', 'AV VILLAS - OTROS CRÉDITOS'),
  convenio('O0104', 'BANCO DE BOGOTÁ - TARJETA DE CRÉDITO MASTERCARD'),
  convenio('O0108', 'BANCO DE BOGOTÁ - LIBRANZA'),
  {
    id: 'occ-ordinaria',
    name: 'Banco De Occidente – Ordinaria - Fomento - Unidirecto - Factoring - Tesorería Y Créditos Especiales',
    department: '',
    acceptsEnrollment: false,
    logo: agreementLogo,
  },
  convenio('O0304', 'Banco Popular Libre Destino Leasing Comercial Constructor Microcrédito (ex)empleado'),
  convenio('00007037', 'Recaudo Cartera Castigada B Occiden', true),
  convenio('O0403', 'Av Villas - Dinero Extra'),
  convenio('O0407', 'Av Villas Credito Factoring', true),
  convenio('O0411', 'Av Villas-credifamilia', true),
  convenio('00016833', 'Banco Popular Negociaciones', true),
  convenio('O0410', 'Av Villas Recarga Tu Cuenta', true),
  convenio('00007287', 'Banco Popular Epik', true),
  convenio('00013662', 'Libranza Banco Popular', true),
  convenio('O0210', 'Banco De Occidente - Crédito Rotativo'),
  convenio('00000032', 'Pago Tc Banco Popular Pago Minimo', true),
  convenio('O0106', 'Banco De Bogotá - Adelanto De Nómina'),
  convenio('00030164', 'Bdo Ft Lbz'),
  convenio('00022505', 'Leasing Operativo Av Villas', true),
  convenio('O0107', 'Banco De Bogotá - Crediestudiantil'),
  convenio('O0111', 'Banco De Bogotá - Ceropay'),
  convenio('O0209', 'Banco De Occidente - Universidad Garantizada'),
  convenio('00009506', 'Banco De Occidente Prestamo Dinamico', true),
];
