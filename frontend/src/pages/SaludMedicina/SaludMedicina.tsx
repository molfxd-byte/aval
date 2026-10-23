import { images } from '@/assets/images';
import { saludAgreements, saludContent } from '@/data/saludMedicina';
import ObligacionesAval from '@/pages/ObligacionesAval/ObligacionesAval';

function SaludMedicina() {
  return (
    <ObligacionesAval
      content={saludContent}
      agreements={saludAgreements}
      payBase="/salud-medicina/pagar"
      hero={images.categoryHealth}
    />
  );
}

export default SaludMedicina;
