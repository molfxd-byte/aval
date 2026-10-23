import agreementLogo from '@/assets/images/Agreements/agreement-default.svg';
import logoAval from '@/assets/images/Payment/logo-aval.svg';
import logoPse from '@/assets/images/Payment/logo-pse.svg';
import type { Agreement } from '@/data/agreements';
import { obligacionesContent } from '@/data/agreements';
import type { PaymentField, PaymentMethodOption, PaymentView } from '@/data/payments';
import { catalogCategories, findCatalogCategory } from '@/data/catalogCategories';
import type { ServicioRecord } from '@/data/serviciosPublicos';

const methodCatalog: Record<string, PaymentMethodOption> = {
  aval: { id: 'aval', title: 'Pagos Aval', logo: logoAval },
  pse: { id: 'pse', title: 'PSE', logo: logoPse },
};

const modules = import.meta.glob<{ default: ServicioRecord[] }>(
  [
    './asociaciones.json',
    './centros-comerciales.json',
    './comercializadoras.json',
    './cooperativas.json',
    './empresas-de-seguros.json',
    './fondo-de-empleados.json',
    './fundaciones.json',
    './impuestos.json',
    './industria.json',
    './instituciones-educativas.json',
    './obligaciones-financieras.json',
    './otros-servicios.json',
    './pagos-pila.json',
    './servicios-de-seguridad.json',
    './servicios-de-transporte.json',
    './servicios-exequiales.json',
    './servicios-inmobiliarios.json',
    './tecnologia.json',
    './telecomunicacion.json',
    './telefonia-celular.json',
    './television.json',
    './viajes-y-turismo.json',
  ],
  { eager: true },
);

function recordsFor(slug: string) {
  return modules[`./${slug}.json`]?.default ?? [];
}

function toPayment(item: ServicioRecord): PaymentView {
  return {
    id: item.id,
    serviceName: item.name,
    helpImage: item.helpImage || undefined,
    plainMethods: item.plainMethods,
    location: item.location || undefined,
    methodsLead: item.methodsLead,
    submitLabel: item.submitLabel,
    secondaryLabel: item.secondaryLabel,
    showDetail: item.showDetail,
    showTerms: item.showTerms,
    showLogin: item.showLogin,
    methods: item.methods.map((method) => methodCatalog[method]).filter((method): method is PaymentMethodOption => Boolean(method)),
    fields: item.fields as PaymentField[],
  };
}

const paymentsBySlug = new Map<string, Map<string, PaymentView>>(
  catalogCategories.map((category) => [
    category.slug,
    new Map(recordsFor(category.slug).map((item) => [item.id, toPayment(item)])),
  ]),
);

const paymentsById = new Map<string, PaymentView>();
paymentsBySlug.forEach((payments) => {
  payments.forEach((payment, id) => {
    if (!paymentsById.has(id)) paymentsById.set(id, payment);
  });
});

export function isCatalogSource(source: string) {
  return Boolean(findCatalogCategory(source));
}

export function getCatalogAgreements(slug: string): Agreement[] {
  return recordsFor(slug).map((item) => ({
    id: item.id,
    name: item.name,
    department: item.department,
    acceptsEnrollment: item.acceptsEnrollment,
    logo: item.logo || agreementLogo,
  }));
}

export function getCatalogPayment(slug: string, id: string) {
  return paymentsBySlug.get(slug)?.get(id);
}

export function getCatalogPaymentById(id: string) {
  return paymentsById.get(id);
}

export function getCatalogAgreement(slug: string, id: string) {
  return getCatalogAgreements(slug).find((item) => item.id === id);
}

export function catalogContent(slug: string) {
  const category = findCatalogCategory(slug);
  return {
    ...obligacionesContent,
    title: category?.title ?? '',
    crumbs: [
      { label: 'Inicio', href: '/' },
      { label: '¿Qué quieres pagar hoy?', href: '/que-quieres-pagar' },
      { label: category?.title ?? '' },
    ],
  };
}
