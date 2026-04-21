/**
 * PrivateRoute.jsx - Protezione route autenticate
 *
 * Avvolge le route che richiedono login.
 * Se l'utente non è loggato → redirect a /login
 * Se l'autenticazione è ancora in caricamento → mostra spinner
 * Se loggato → mostra il contenuto normale
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  // Attende il controllo iniziale del token (evita flash di redirect)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <LoadingSpinner />
      </div>
    );
  }

  // Non autenticato → manda alla login
  if (!user) {
    console.log('[PRIVATE_ROUTE] Utente non autenticato, redirect a /login');
    return <Navigate to="/login" replace />;
  }

  return children;
}
