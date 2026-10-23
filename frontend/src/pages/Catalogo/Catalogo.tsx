import { catalogContent, getCatalogAgreements } from '@/data/catalogStore';
import { findCatalogCategory } from '@/data/catalogCategories';
import ObligacionesAval from '@/pages/ObligacionesAval/ObligacionesAval';

function Catalogo({ slug }: { slug: string }) {
  const category = findCatalogCategory(slug);
  if (!category) return null;

  return (
    <ObligacionesAval
      content={catalogContent(slug)}
      agreements={getCatalogAgreements(slug)}
      payBase={`/${slug}/pagar`}
      hero={category.image}
    />
  );
}

export default Catalogo;
