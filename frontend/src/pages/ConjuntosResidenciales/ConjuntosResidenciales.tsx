import { images } from '@/assets/images';
import { conjuntosAgreements, conjuntosContent } from '@/data/conjuntosResidenciales';
import ObligacionesAval from '@/pages/ObligacionesAval/ObligacionesAval';

function ConjuntosResidenciales() {
  return (
    <ObligacionesAval
      content={conjuntosContent}
      agreements={conjuntosAgreements}
      payBase="/conjuntos-residenciales/pagar"
      hero={images.categoryAdministration}
    />
  );
}

export default ConjuntosResidenciales;
