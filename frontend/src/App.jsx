/**
 * App.jsx - Punto di ingresso dell'applicazione React
 *
 * Qui si definisce il sistema di routing.
 * React Router DOM funziona così:
 *   - <BrowserRouter> abilita la navigazione tramite URL del browser
 *   - <Routes> è il contenitore delle route
 *   - <Route> mappa un URL a un componente
 *   - <Layout> è il "wrapper" che contiene sidebar + header,
 *     mentre le pagine specifiche vanno dentro l'<Outlet>
 *
 * Struttura URL:
 *   /               → DashboardMappa
 *   /statistiche    → StatisticheQuartiere
 *   /import         → ImportDati
 *   /valutazione    → WizardValutazione
 *   /portafoglio    → MieiInvestimenti
 *   /impostazioni   → Impostazioni
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardMappa         from './pages/DashboardMappa';
import StatisticheQuartiere   from './pages/StatisticheQuartiere';
import ImportDati             from './pages/ImportDati';
import WizardValutazione      from './pages/WizardValutazione';
import MieiInvestimenti       from './pages/MieiInvestimenti';
import Impostazioni           from './pages/Impostazioni';
import DettaglioTipologia     from './pages/DettaglioTipologia';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/*
          Layout è il genitore: renderizza sidebar + header.
          Le route figlie vengono inserite dentro <Outlet /> nel Layout.
        */}
        <Route path="/" element={<Layout />}>
          <Route index               element={<DashboardMappa />} />
          <Route path="statistiche"  element={<StatisticheQuartiere />} />
          <Route path="import"       element={<ImportDati />} />
          <Route path="valutazione"  element={<WizardValutazione />} />
          <Route path="portafoglio"  element={<MieiInvestimenti />} />
          <Route path="impostazioni" element={<Impostazioni />} />
          <Route path="tipologia"   element={<DettaglioTipologia />} />

          {/* Qualsiasi URL non riconosciuto → reindirizza alla home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
