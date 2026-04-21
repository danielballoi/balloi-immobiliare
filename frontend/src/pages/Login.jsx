/**
 * Login.jsx - Pagina di accesso
 *
 * Layout a due colonne ispirato allo screen fornito:
 *   Sinistra: pannello marketing con headline "Investi su Cagliari. & hinterland."
 *   Destra:   form di login con email + password
 *
 * Sicurezza lato client:
 *   - Nessuna password in chiaro in console o localStorage
 *   - Messaggi errore generici (non rivela se email esiste)
 *   - Disabilita il pulsante durante la richiesta (prevent double-submit)
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Stato form
  const [form, setForm]       = useState({ email: '', password: '' });
  const [errore, setErrore]   = useState('');
  const [loading, setLoading] = useState(false);
  const [mostraPwd, setMostraPwd] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrore(''); // resetta errore mentre l'utente digita
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setErrore('Compila tutti i campi');
      return;
    }

    setLoading(true);
    setErrore('');

    try {
      const { data } = await api.post('/auth/login', {
        email:    form.email.trim(),
        password: form.password,
      });

      // Salva token e user nel contesto globale
      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Errore di connessione al server';
      setErrore(msg);
      console.log('[LOGIN] Errore:', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0d1117' }}>

      {/* ══════════════════════════════════════════════════════════════
          PANNELLO SINISTRO — pitch marketing
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col justify-between w-5/12 p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1117 0%, #1a1d27 60%, #0d1117 100%)' }}
      >
        {/* Sfondo decorativo — cerchi gradient sfumati */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.05) 0%, transparent 50%)',
          }}
        />

        {/* Logo Balloi */}
        <div className="relative flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'var(--accent)' }}
          >
            B
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Balloi</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Immobiliare</div>
          </div>
        </div>

        {/* Contenuto principale */}
        <div className="relative">
          <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
            PIATTAFORMA IMMOBILIARE
          </p>
          <h1 className="text-4xl font-bold leading-tight mb-6" style={{ color: 'var(--text-primary)' }}>
            Investi su<br />
            <span style={{ color: 'var(--accent)' }}>Cagliari.</span><br />
            & hinterland.
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
            La prima piattaforma con dati OMI ufficiali per analizzare, valutare e gestire
            investimenti immobiliari a Cagliari e nei comuni dell'hinterland sardo.
          </p>

          {/* Feature bullets */}
          {[
            'Mappe di calore prezzi per quartiere',
            'Wizard valutazione con 3 metodologie (VCM, Reddituale, DCF)',
            'Gestione portafoglio investimenti',
          ].map(feat => (
            <div key={feat} className="flex items-center gap-3 mb-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{feat}</span>
            </div>
          ))}
        </div>

        {/* Link crea account in basso */}
        <div className="relative">
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Non hai ancora un account?</p>
          <Link
            to="/register"
            className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: 'transparent',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}
          >
            Crea Account →
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          PANNELLO DESTRO — form login
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">

        {/* Logo mobile (visibile solo su schermi piccoli) */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'var(--accent)' }}
          >
            B
          </div>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Balloi Immobiliare</span>
        </div>

        {/* Card form */}
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {/* Logo desktop dentro la card */}
          <div className="hidden lg:flex items-center justify-center gap-2 mb-6">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ background: 'var(--accent)' }}
            >
              B
            </div>
            <div className="text-left">
              <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Balloi Immobiliare</div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1 text-center" style={{ color: 'var(--text-primary)' }}>
            Accesso Immobili
          </h2>
          <p className="text-xs text-center mb-7" style={{ color: 'var(--text-muted)' }}>
            Inserisci le tue credenziali per accedere
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Campo Email */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                placeholder="tua@email.it"
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-150"
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Campo Password */}
            <div className="mb-6">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={mostraPwd ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-3 pr-11 rounded-lg text-sm outline-none transition-all duration-150"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
                {/* Toggle visibilità password */}
                <button
                  type="button"
                  onClick={() => setMostraPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={mostraPwd ? 'Nascondi password' : 'Mostra password'}
                >
                  {mostraPwd ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Messaggio errore */}
            {errore && (
              <div
                className="mb-4 px-4 py-3 rounded-lg text-sm text-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
              >
                {errore}
              </div>
            )}

            {/* Pulsante submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-bold transition-all duration-150"
              style={{
                background: loading ? 'rgba(245,158,11,0.5)' : 'var(--accent)',
                color: '#0f1117',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Accesso in corso…' : 'Entra in Immobile →'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>oppure</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Link registrazione (mobile) */}
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Non hai un account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
