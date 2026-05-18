import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout      from './components/Layout';

// Pagine pubbliche — caricate subito (bundle iniziale piccolo)
import Login    from './pages/Login';
import Register from './pages/Register';

// Pagine protette — lazy loaded (split per ridurre bundle iniziale)
const DashboardMappa       = lazy(() => import('./pages/DashboardMappa'));
const StatisticheQuartiere = lazy(() => import('./pages/StatisticheQuartiere'));
const ImportDati           = lazy(() => import('./pages/ImportDati'));
const WizardValutazione    = lazy(() => import('./pages/WizardValutazione'));
const MieiInvestimenti     = lazy(() => import('./pages/MieiInvestimenti'));
const ValutaTu             = lazy(() => import('./pages/ValutaTu'));
const Impostazioni         = lazy(() => import('./pages/Impostazioni'));
const DettaglioTipologia   = lazy(() => import('./pages/DettaglioTipologia'));
const Utenze               = lazy(() => import('./pages/Utenze'));

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

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
              <Route path="valuta-tu"    element={<ValutaTu />} />
              <Route path="valutazione"  element={<WizardValutazione />} />
              <Route path="portafoglio"  element={<MieiInvestimenti />} />
              <Route path="impostazioni" element={<Impostazioni />} />
              <Route path="tipologia"    element={<DettaglioTipologia />} />
              <Route path="utenze"       element={<Utenze />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
