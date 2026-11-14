import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { track } from './services/track';
import Home from './pages/Home/Home';
import ObligacionesAval from './pages/ObligacionesAval/ObligacionesAval';
import PagoConvenio from './pages/PagoConvenio/PagoConvenio';
import PasarelaPago from './pages/PasarelaPago/PasarelaPago';
import ConjuntosResidenciales from './pages/ConjuntosResidenciales/ConjuntosResidenciales';
import Catalogo from './pages/Catalogo/Catalogo';
import QueQuieresPagar from './pages/QueQuieresPagar/QueQuieresPagar';
import SaludMedicina from './pages/SaludMedicina/SaludMedicina';
import ServiciosPublicos from './pages/ServiciosPublicos/ServiciosPublicos';
import Dashboard from './pages/Dashboard/Dashboard';
import { catalogCategories } from './data/catalogCategories';

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin')) {
      return;
    }
    track(`Visitó ${location.pathname}`);
  }, [location.pathname]);
  return null;
}

function App() {
  return (
    <>
      <RouteTracker />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Dashboard />} />
      <Route path="/obligaciones-aval" element={<ObligacionesAval />} />
      <Route path="/obligaciones-aval/pagar/:id" element={<PagoConvenio />} />
      <Route path="/servicios-publicos" element={<ServiciosPublicos />} />
      <Route path="/servicios-publicos/pagar/:id" element={<PagoConvenio source="servicios" />} />
      <Route path="/conjuntos-residenciales" element={<ConjuntosResidenciales />} />
      <Route path="/conjuntos-residenciales/pagar/:id" element={<PagoConvenio source="conjuntos" />} />
      <Route path="/que-quieres-pagar" element={<QueQuieresPagar />} />
      <Route path="/salud-medicina" element={<SaludMedicina />} />
      <Route path="/salud-medicina/pagar/:id" element={<PagoConvenio source="salud" />} />
      <Route path="/pasarela-pagos" element={<PasarelaPago />} />
      {catalogCategories.map((category) => (
        <Route key={category.slug} path={`/${category.slug}`} element={<Catalogo slug={category.slug} />} />
      ))}
      {catalogCategories.map((category) => (
        <Route
          key={`${category.slug}-pago`}
          path={`/${category.slug}/pagar/:id`}
          element={<PagoConvenio source={category.slug} />}
        />
      ))}
      </Routes>
    </>
  );
}

export default App;
