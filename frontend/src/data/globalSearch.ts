import type { Agreement } from '@/data/agreements';
import { obligacionesAgreements } from '@/data/agreements';
import { catalogCategories } from '@/data/catalogCategories';
import { getCatalogAgreements } from '@/data/catalogStore';
import { conjuntosAgreements } from '@/data/conjuntosResidenciales';
import { saludAgreements } from '@/data/saludMedicina';
import { serviciosAgreements } from '@/data/serviciosPublicos';

export interface SearchHit {
  id: string;
  name: string;
  logo: string;
  to: string;
}

const sources: [Agreement[], string][] = [
  [obligacionesAgreements, '/obligaciones-aval'],
  [serviciosAgreements, '/servicios-publicos'],
  [conjuntosAgreements, '/conjuntos-residenciales'],
  [saludAgreements, '/salud-medicina'],
  ...catalogCategories.map((c): [Agreement[], string] => [getCatalogAgreements(c.slug), `/${c.slug}`]),
];

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

let index: (SearchHit & { key: string })[] | undefined;

function buildIndex() {
  const seen = new Set<string>();
  index = [];
  for (const [items, base] of sources) {
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      index.push({
        id: item.id,
        name: item.name,
        logo: item.logo,
        to: `${base}/pagar/${item.id}`,
        key: normalize(`${item.name} ${item.id}`),
      });
    }
  }
  return index;
}

export function searchAgreements(query: string, limit = 8): SearchHit[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const hits = (index ?? buildIndex()).filter((item) => tokens.every((t) => item.key.includes(t)));
  // los que empiezan por lo escrito van primero
  const first = tokens[0];
  hits.sort((a, b) => Number(b.key.startsWith(first)) - Number(a.key.startsWith(first)));
  return hits.slice(0, limit);
}
