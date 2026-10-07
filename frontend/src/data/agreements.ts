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
    name: 'Banco De Occidente - Ordinaria - Fomento - Unidirecto - Factoring - Tesorería y Créditos Especiales',
    department: '',
    acceptsEnrollment: false,
    logo: agreementLogo,
  },
  convenio('O0304', 'Banco Popular Libre Destino Leasing Comercial Constructor Microcrédito (Ex)Empleado'),
  convenio('00007037', 'RECAUDO CARTERA CASTIGADA B OCCIDEN', true),
  convenio('O0403', 'AV VILLAS - DINERO EXTRA'),
  convenio('O0407', 'AV VILLAS CREDITO FACTORING', true),
  convenio('O0411', 'AV VILLAS-CREDIFAMILIA', true),
  convenio('00016833', 'BANCO POPULAR NEGOCIACIONES', true),
  convenio('O0410', 'AV VILLAS RECARGA TU CUENTA', true),
  convenio('00007287', 'Banco Popular EPIK', true),
  convenio('00013662', 'LIBRANZA BANCO POPULAR', true),
  convenio('O0210', 'BANCO DE OCCIDENTE - CRÉDITO ROTATIVO'),
  convenio('00000032', 'PAGO TC BANCO POPULAR PAGO MINIMO', true),
  convenio('O0106', 'BANCO DE BOGOTÁ - ADELANTO DE NÓMINA'),
  convenio('00030164', 'BDO FT LBZ'),
  convenio('00022505', 'Leasing Operativo AV Villas', true),
  convenio('O0107', 'BANCO DE BOGOTÁ - CREDIESTUDIANTIL'),
  convenio('O0111', 'Banco De Bogotá - CeroPay'),
  convenio('O0209', 'BANCO DE OCCIDENTE - UNIVERSIDAD GARANTIZADA'),
  convenio('00009506', 'Banco de Occidente Prestamo Dinamico', true),
];
