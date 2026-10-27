import agreementLogo from '@/assets/images/Agreements/agreement-default.svg';
import type { Agreement } from '@/data/agreements';
import type { PaymentField, PaymentMethodOption, PaymentView } from '@/data/payments';
import { logoAval, logoBreb, logoPse } from '@/data/payments';
import records from '@/data/servicios-publicos.json';

export interface ServicioRecord {
  id: string;
  name: string;
  department: string;
  location: string;
  address?: string;
  acceptsEnrollment: boolean;
  logo: string;
  helpImage: string;
  plainMethods: boolean;
  methodsLead: string;
  submitLabel: string;
  secondaryLabel: string;
  showDetail: boolean;
  showTerms: boolean;
  showLogin: boolean;
  methods: string[];
  fields: PaymentField[];
}

const methodCatalog: Record<string, PaymentMethodOption> = {
  breb: { id: 'breb', title: 'Bre-B', logo: logoBreb },
  aval: { id: 'aval', title: 'Pagos Aval', logo: logoAval },
  pse: { id: 'pse', title: 'PSE', logo: logoPse },
};

const servicios = records as ServicioRecord[];

export const serviciosContent = {
  title: 'Servicios Públicos',
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
    { label: '¿Qué quieres pagar hoy?', href: '/que-quieres-pagar' },
    { label: 'Servicios Públicos' },
  ],
};

export const serviciosAgreements: Agreement[] = servicios.map((item) => ({
  id: item.id,
  name: item.name,
  department: item.department,
  acceptsEnrollment: item.acceptsEnrollment,
  logo: item.logo || agreementLogo,
}));

const payments = new Map<string, PaymentView>(
  servicios.map((item) => [
    item.id,
    {
      id: item.id,
      serviceName: item.name,
      helpImage: item.helpImage || undefined,
      plainMethods: item.plainMethods,
      location: item.location,
      address: item.address || undefined,
      methodsLead: item.methodsLead,
      submitLabel: item.submitLabel,
      secondaryLabel: item.secondaryLabel,
      showDetail: item.showDetail,
      showTerms: item.showTerms,
      showLogin: item.showLogin,
      methods: item.methods.map((method) => methodCatalog[method]).filter(Boolean),
      fields: item.fields,
    },
  ]),
);

export function getServicioPayment(id: string) {
  return payments.get(id);
}
