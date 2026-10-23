import { images } from '@/assets/images';
import { catalogCategories } from '@/data/catalogCategories';
import type { FastPayment } from '@/types/home';

export const queQuieresPagarContent = {
  title: '¿Qué quieres pagar hoy?',
  crumbs: [
    { label: 'Inicio', href: '/' },
    { label: '¿Qué quieres pagar hoy?' },
  ],
  floatingLabel: 'Realiza un pago',
};

export const featuredCategories: FastPayment[] = [
  { id: 'obligaciones-aval', title: 'Obligaciones\nAVAL', image: images.categoryCards, href: '/obligaciones-aval' },
  { id: 'servicios-publicos', title: 'Servicios\nPúblicos', image: images.categoryUtilities, href: '/servicios-publicos' },
];

export const categoryCards: FastPayment[] = [
  { id: 'conjuntos-residenciales', title: 'Conjuntos Residenciales', image: images.categoryAdministration, href: '/conjuntos-residenciales' },
  { id: 'salud-medicina', title: 'Salud Y Medicina', image: images.categoryHealth, href: '/salud-medicina' },
  ...catalogCategories.map((category) => ({
    id: category.slug,
    title: category.title,
    image: category.image,
    href: `/${category.slug}`,
  })),
];
