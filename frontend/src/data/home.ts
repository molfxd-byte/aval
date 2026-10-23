import { benefitImages, images, newsImages } from '@/assets/images';
import type {
  BenefitSlide,
  FastPayment,
  FooterLink,
  NavItem,
  NewsSlide,
  PaymentMethod,
} from '@/types/home';

export const navItems: NavItem[] = [
  { label: 'Inicio', href: '/', active: true },
  { label: '¿Qué quieres pagar hoy?', href: '/que-quieres-pagar' },
  { label: 'Validar mi pago', href: '#' },
  { label: 'Centro de ayuda', href: '#' },
  {
    label: 'Ingresa',
    href: '#',
    children: [
      { label: 'Personas', href: '#' },
      { label: 'Empresas', href: '#' },
    ],
  },
];

export const searchContent = {
  title: '¿Qué deseas pagar hoy?',
  label: 'Escribe el nombre del convenio',
};

export const fastPaymentsContent = {
  title: 'Pagos Rápidos',
  linkLabel: 'Ver todos',
  linkHref: '/que-quieres-pagar',
};

export const fastPayments: FastPayment[] = [
  { id: 'obligaciones-aval', title: 'Obligaciones\nAval', image: images.categoryCards, href: '/obligaciones-aval' },
  { id: 'servicios-publicos', title: 'Servicios\nPúblicos', image: images.categoryUtilities, href: '/servicios-publicos' },
  { id: 'conjuntos-residenciales', title: 'Conjuntos\nResidenciales', image: images.categoryAdministration, href: '/conjuntos-residenciales' },
  { id: 'salud-medicina', title: 'Salud\ny Medicina', image: images.categoryHealth, href: '/salud-medicina' },
  { id: 'itau', title: 'Banco Itaú', image: images.logoItau, imageClass: 'img-itau', href: '#', isNew: true },
];

export const benefitsContent = {
  title: 'Beneficios',
};

export const benefitSlides: BenefitSlide[] = [
  {
    id: 'un-solo-lugar',
    subtitle: 'En un sólo lugar',
    text: 'Accede a más de 25 mil convenios públicos y privados para pago a nivel nacional 24 horas disponibles.',
    images: benefitImages.slide1,
  },
  {
    id: 'medios-de-pago',
    subtitle: 'Tus medios de pago preferidos',
    text: 'Realiza tus pagos con tus productos Aval, Tarjetas de Crédito de cualquier entidad financiera y PSE en un solo lugar sin costos adicionales y de forma segura.',
    images: benefitImages.slide2,
  },
  {
    id: 'gratis-disponible-seguro',
    subtitle: 'Gratis, disponible y seguro',
    text: 'Encuentra un servicio disponible las 24 horas, con procesos simples y seguros a 0 costo.',
    images: benefitImages.slide3,
  },
];

export const newsSlides: NewsSlide[] = [
  {
    id: 'no-olvides',
    title: 'No olvides',
    text: 'Tener a la mano el número de referencia de pago o datos de tú obligación y recursos disponibles para realizar tu pago de manera ágil.',
    image: newsImages.noOlvides,
    buttonLabel: 'Saber más',
    href: '#',
  },
  {
    id: 'registrate-seguridad',
    title: 'Regístrate y accede con seguridad',
    text: 'Cuentas con un portal de pagos con usuario y contraseña donde estará protegida tu información personal y financiera.',
    image: newsImages.seguridad,
    buttonLabel: 'Saber más',
    href: '#',
  },
  {
    id: 'bancos-aval',
    title: 'Si haces parte de los Bancos Aval recuerda que:',
    text: 'Puedes hacer pagos a través del botón Aval usando tus cuentas de ahorros y cuentas corrientes.',
    image: newsImages.botonAval,
    buttonLabel: 'Saber más',
    href: '#',
  },
];

export const bannerContent = {
  title: 'Regístrate y realiza tus pagos más rápido',
  subtitle: 'Ten acceso a pagos recurrentes e historial de pagos',
  buttonLabel: 'Regístrate',
};

export const paymentMethodsContent = {
  title: 'Medios de Pago',
  description: 'Los medios de pago son opcionales de acuerdo a lo configurado para cada servicio/convenio.',
};

export const paymentMethods: PaymentMethod[] = [
  {
    id: 'aval',
    title: 'Bancos Aval',
    description: 'Cuentas de ahorros y cuentas corrientes de AV Villas, Banco de Bogotá, Banco de Occidente, Banco Popular.',
    image: images.logoAvalGroup,
    logoClass: 'aval-group-logo',
  },
  {
    id: 'pse',
    title: 'Botón PSE',
    description: 'Cuentas bancarias de las entidades financieras habilitadas en PSE.',
    image: images.logoPse,
    logoClass: 'pse-logo',
  },
  {
    id: 'visa',
    title: 'Tarjetas de crédito',
    description: 'Tarjetas de crédito de las franquicias VISA y MasterCard de cualquier entidad financiera.',
    image: images.logoVisa,
    logoClass: 'visa-logo',
  },
  {
    id: 'bre-b',
    title: 'Bre-B',
    description: 'Paga al instante con tu llave Bre-B desde cualquier entidad.',
    image: images.logoBreB,
    logoClass: 'bre-b-logo',
  },
];

export const footerLinks: FooterLink[] = [
  { label: 'Términos y condiciones', href: '#' },
  { label: 'Política de privacidad', href: '#' },
  { label: 'Preguntas frecuentes', href: '#' },
];

export const footerContact = [
  { label: 'Bogotá:', value: '(601) 000 0000', href: 'tel:6010000000' },
  { label: 'Resto del país:', value: '01 8000 000 000', href: 'tel:018000000000' },
];
