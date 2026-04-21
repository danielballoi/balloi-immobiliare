/**
 * AuthContext.jsx - Contesto globale di autenticazione
 *
 * React Context è un modo per condividere stato tra componenti
 * senza passare props manualmente attraverso ogni livello.
 *
 * Questo contesto gestisce:
 *   - user: dati utente corrente (o null se non loggato)
 *   - token: JWT salvato in localStorage
 *   - login(): salva token + user dopo autenticazione
 *   - logout(): pulisce tutto e reindirizza a /login
 *   - loading: true durante il controllo iniziale del token
 *
 * Sicurezza localStorage:
 *   - È vulnerabile a XSS se l'app ha dipendenze malevole
 *   - React previene XSS per default (escaping automatico)
 *   - Alternativa più sicura: httpOnly cookie (ma richiede proxy)
 *   - Per questa app locale è accettabile
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Crea il contesto vuoto — verrà popolato dal Provider
const AuthContext = createContext(null);

// ── Chiavi localStorage ────────────────────────────────────────────────────
const TOKEN_KEY = 'balloi_jwt';
const USER_KEY  = 'balloi_user';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true finché non verifichiamo il token

  /**
   * Al primo avvio: controlla se c'è un token salvato in localStorage.
   * Se sì, lo verifica con il backend per assicurarsi che non sia scaduto.
   */
  useEffect(() => {
    async function verificaTokenSalvato() {
      const tokenSalvato = localStorage.getItem(TOKEN_KEY);
      if (!tokenSalvato) {
        setLoading(false);
        return;
      }

      try {
        // Imposta il token sull'istanza axios prima di chiamare /me
        api.defaults.headers.common['Authorization'] = `Bearer ${tokenSalvato}`;
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        console.log('[AUTH] Sessione ripristinata per:', data.user.email);
      } catch {
        // Token scaduto o non valido: pulisce tutto
        console.log('[AUTH] Token scaduto, richiede nuovo login');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    }

    verificaTokenSalvato();
  }, []);

  /**
   * login() — chiamata dopo /api/auth/login riuscito
   * Salva token e user in localStorage e imposta l'header axios
   */
  const login = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    console.log('[AUTH] Login completato:', userData.email);
  }, []);

  /**
   * logout() — rimuove tutto e reindirizza alla pagina di login
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    console.log('[AUTH] Logout eseguito');
    // Reindirizza hard: pulisce lo stato React completamente
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook custom per usare il contesto auth in qualsiasi componente:
 *   const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
