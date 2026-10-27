import agreementLogo from '@/assets/images/Agreements/agreement-default.svg';
import type { Agreement } from '@/data/agreements';
import type { PaymentField, PaymentMethodOption, PaymentView } from '@/data/payments';
import { logoAval, logoBreb, logoPse } from '@/data/payments';
import records from '@/data/conjuntos-residenciales.json';
import type { ServicioRecord } from '@/data/serviciosPublicos';

const methodCatalog: Record<string, PaymentMethodOption> = {
  breb: { id: 'breb', title: 'Bre-B', logo: logoBreb },
  aval: { id: 'aval', title: 'Pagos Aval', logo: logoAval },
  pse: { id: 'pse', title: 'PSE', logo: logoPse },
};

const conjuntos = records as ServicioRecord[];

export const conjuntosContent = {
  title: 'Conjuntos Residenciales',
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
    { label: 'Conjuntos Residenciales' },
  ],
};

export const conjuntosAgreements: Agreement[] = conjuntos.map((item) => ({
  id: item.id,
  name: item.name,
  department: item.department,
  acceptsEnrollment: item.acceptsEnrollment,
  logo: item.logo || agreementLogo,
}));

const payments = new Map<string, PaymentView>(
  conjuntos.map((item) => [
    item.id,
    {
      id: item.id,
      serviceName: item.name,
      helpImage: item.helpImage || undefined,
      plainMethods: item.plainMethods,
      location: item.location || undefined,
      address: item.address || undefined,
      methodsLead: item.methodsLead,
      submitLabel: item.submitLabel,
      secondaryLabel: item.secondaryLabel,
      showDetail: item.showDetail,
      showTerms: item.showTerms,
      showLogin: item.showLogin,
      methods: item.methods.map((method) => methodCatalog[method]).filter((method): method is PaymentMethodOption => Boolean(method)),
      fields: item.fields as PaymentField[],
    },
  ]),
);

export function getConjuntoPayment(id: string) {
  return payments.get(id);
}
