import { images } from '@/assets/images';
import ObligacionesAval from '@/pages/ObligacionesAval/ObligacionesAval';
import { serviciosAgreements, serviciosContent } from '@/data/serviciosPublicos';

function ServiciosPublicos() {
  return (
    <ObligacionesAval
      content={serviciosContent}
      agreements={serviciosAgreements}
      payBase="/servicios-publicos/pagar"
      hero={images.categoryUtilities}
    />
  );
}

export default ServiciosPublicos;
