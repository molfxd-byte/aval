import category1 from '@/assets/images/Categories/category1.svg';
import category2 from '@/assets/images/Categories/category2.svg';
import category3 from '@/assets/images/Categories/category3.svg';
import category4 from '@/assets/images/Categories/category4.svg';
import category5 from '@/assets/images/Categories/category5.svg';
import category7 from '@/assets/images/Categories/category7.svg';
import category8 from '@/assets/images/Categories/category8.svg';
import category9 from '@/assets/images/Categories/category9.svg';
import category10 from '@/assets/images/Categories/category10.svg';
import category11 from '@/assets/images/Categories/category11.svg';
import category12 from '@/assets/images/Categories/category12.svg';
import category13 from '@/assets/images/Categories/category13.svg';
import category14 from '@/assets/images/Categories/category14.svg';
import category15 from '@/assets/images/Categories/category15.svg';
import category17 from '@/assets/images/Categories/category17.svg';
import category18 from '@/assets/images/Categories/category18.svg';
import category20 from '@/assets/images/Categories/category20.svg';
import category21 from '@/assets/images/Categories/category21.svg';
import category22 from '@/assets/images/Categories/category22.svg';
import category23 from '@/assets/images/Categories/category23.svg';
import category24 from '@/assets/images/Categories/category24.svg';
import category27 from '@/assets/images/Categories/category27.svg';

export interface CatalogCategory {
  slug: string;
  title: string;
  categoryId: string;
  image: string;
}

export const catalogCategories: CatalogCategory[] = [
  { slug: 'asociaciones', title: 'Asociaciones', categoryId: '2', image: category2 },
  { slug: 'centros-comerciales', title: 'Centros Comerciales', categoryId: '3', image: category3 },
  { slug: 'comercializadoras', title: 'Comercializadoras', categoryId: '5', image: category5 },
  { slug: 'cooperativas', title: 'Cooperativas', categoryId: '7', image: category7 },
  { slug: 'empresas-de-seguros', title: 'Empresas de Seguros', categoryId: '15', image: category15 },
  { slug: 'fondo-de-empleados', title: 'Fondo de empleados', categoryId: '1', image: category1 },
  { slug: 'fundaciones', title: 'Fundaciones', categoryId: '9', image: category9 },
  { slug: 'impuestos', title: 'Impuestos', categoryId: '11', image: category11 },
  { slug: 'industria', title: 'Industria', categoryId: '12', image: category12 },
  { slug: 'instituciones-educativas', title: 'Instituciones Educativas', categoryId: '4', image: category4 },
  { slug: 'obligaciones-financieras', title: 'Obligaciones Financieras', categoryId: '13', image: category13 },
  { slug: 'otros-servicios', title: 'Otros Servicios', categoryId: '14', image: category14 },
  { slug: 'pagos-pila', title: 'Pagos PILA', categoryId: '27', image: category27 },
  { slug: 'servicios-de-seguridad', title: 'Servicios de Seguridad', categoryId: '8', image: category8 },
  { slug: 'servicios-de-transporte', title: 'Servicios de Transporte', categoryId: '17', image: category17 },
  { slug: 'servicios-exequiales', title: 'Servicios Exequiales', categoryId: '10', image: category10 },
  { slug: 'servicios-inmobiliarios', title: 'Servicios Inmobiliarios', categoryId: '18', image: category18 },
  { slug: 'tecnologia', title: 'Tecnología', categoryId: '20', image: category20 },
  { slug: 'telecomunicacion', title: 'Telecomunicación', categoryId: '22', image: category22 },
  { slug: 'telefonia-celular', title: 'Telefonía Celular', categoryId: '21', image: category21 },
  { slug: 'television', title: 'Televisión por Suscripción', categoryId: '23', image: category23 },
  { slug: 'viajes-y-turismo', title: 'Viajes y Turismo', categoryId: '24', image: category24 },
];

export function findCatalogCategory(slug: string) {
  return catalogCategories.find((category) => category.slug === slug);
}
