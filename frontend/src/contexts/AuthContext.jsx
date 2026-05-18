/**
 * AuthContext.jsx - Contesto globale di autenticazione
 *
 * Il token JWT NON è più in localStorage (vulnerabile a XSS).
 * Viene gestito interamente tramite cookie httpOnly impostati dal backend:
 *   - balloi_token   → access token (15 min)
 *   - balloi_refresh → refresh token (30 giorni, ruotante)
 *
 * Al mount verifica la sessione chiamando /auth/me (il cookie viene
 * inviato automaticamente dal browser grazie a withCredentials: true).
 * Se il token è scaduto, l'interceptor axios in api.js chiama /auth/refresh
 * in modo trasparente prima di restituire il controllo qui.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /**
   * login() — chiamata dopo /api/auth/login riuscito.
   * Il token è già nel cookie httpOnly; qui salviamo solo i dati utente in memoria.
   */
  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  /**
   * logout() — revoca il refresh token sul backend, cancella i cookie,
   * azzera lo stato React e reindirizza al login.
   */
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Se la chiamata fallisce puliamo comunque lo stato locale
    }
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
