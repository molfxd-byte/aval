import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home/Home';
import ObligacionesAval from './pages/ObligacionesAval/ObligacionesAval';
import PagoConvenio from './pages/PagoConvenio/PagoConvenio';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/obligaciones-aval" element={<ObligacionesAval />} />
      <Route path="/obligaciones-aval/pagar/:id" element={<PagoConvenio />} />
    </Routes>
  );
}

export default App;
