/**
 * App.jsx - Punto di ingresso dell'applicazione React
 *
 * Routing:
 *   /login      → Login (pubblica)
 *   /register   → Register (pubblica)
 *   /           → DashboardMappa (protetta)
 *   /statistiche, /import, /valutazione, /portafoglio, /impostazioni → protette
 *
 * <PrivateRoute> controlla se l'utente è autenticato.
 * Se non lo è, redirige automaticamente a /login.
 *
 * <AuthProvider> avvolge tutto → condivide lo stato auth in ogni componente.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute            from './components/PrivateRoute';
import Layout                  from './components/Layout';
import Login                   from './pages/Login';
import Register                from './pages/Register';
import DashboardMappa          from './pages/DashboardMappa';
import StatisticheQuartiere    from './pages/StatisticheQuartiere';
import ImportDati              from './pages/ImportDati';
import WizardValutazione       from './pages/WizardValutazione';
import MieiInvestimenti        from './pages/MieiInvestimenti';
import Impostazioni            from './pages/Impostazioni';
import DettaglioTipologia      from './pages/DettaglioTipologia';
import Utenze                  from './pages/Utenze';

export default function App() {
  return (
    /*
      AuthProvider deve stare FUORI dal BrowserRouter
      per poter usare window.location.href nel logout senza
      dipendere da React Router.
    */
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Route pubbliche (non richiedono login) ────────────── */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Route protette: avvolte in PrivateRoute ───────────── */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index               element={<DashboardMappa />} />
            <Route path="statistiche"  element={<StatisticheQuartiere />} />
            <Route path="import"       element={<ImportDati />} />
            <Route path="valutazione"  element={<WizardValutazione />} />
            <Route path="portafoglio"  element={<MieiInvestimenti />} />
            <Route path="impostazioni" element={<Impostazioni />} />
            <Route path="tipologia"    element={<DettaglioTipologia />} />
            <Route path="utenze"       element={<Utenze />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Route>

          {/* Qualsiasi altro path → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
