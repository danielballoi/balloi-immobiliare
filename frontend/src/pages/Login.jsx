/**
 * Login — Pagina di accesso
 * Design: split-screen, panel sinistro brand + panel destro form
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

/* ── Sub-componenti ─────────────────────────────────────────────── */
function FeatureRow({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#f59e0b" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

function InputField({ label, type, name, value, onChange, placeholder, autoComplete, disabled, children }) {
  const [focused, setFocused] = useState(false);
  return (
    /* marginBottom 20px — gap minimo tra input per non comprimerli */
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: '12px 16px',
            paddingRight: children ? 48 : 16,
            fontSize: 14,
            borderRadius: 10,
            background: 'var(--bg-input)',
            border: `1px solid ${focused ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: 'var(--text-primary)',
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(245,158,11,0.08)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {children}
      </div>
    </div>
  );
}

/* ── Componente principale ──────────────────────────────────────── */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [errore, setErrore]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrore('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) { setErrore('Compila tutti i campi'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: form.email.trim(), password: form.password });
      login(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setErrore(err.response?.data?.error ?? 'Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#080b12' }}>

      {/* ── Panel sinistro — brand 50% — uguale a Register per coerenza visiva ── */}
      <div style={{
        display: 'none',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '50%',
        padding: '48px 56px',
        background: 'linear-gradient(145deg, #0a0f1a 0%, #0f1520 50%, #080b12 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}
        className="lg:flex"
      >
        {/* Glow decorativo */}
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)', top: '8%', left: '-15%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)', bottom: '15%', right: '-8%', pointerEvents: 'none' }} />

        {/* Logo DBI in alto */}
        <div style={{ position: 'relative' }}>
          <img src="/dbi-logo.png" alt="Daniel Balloi Immobiliare"
            style={{ height: 40, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>

        {/* Headline + passi 01/02/03 */}
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 20 }}>
            Piattaforma Immobiliare
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', color: '#e8edf5', marginBottom: 36 }}>
            Investi su<br />
            <span style={{ color: 'var(--accent)' }}>Cagliari</span><br />
            & hinterland.
          </h1>

          {/* Passaggi numerati 01 / 02 / 03 */}
          {[
            { n: '01', tit: 'Analizza il mercato',    desc: 'Prezzi OMI aggiornati per ogni quartiere di Cagliari.' },
            { n: '02', tit: 'Valuta l\'immobile',     desc: 'Wizard VCM, Reddituale e DCF per stima professionale.' },
            { n: '03', tit: 'Gestisci gli investimenti', desc: 'Portafoglio, censimenti e locazioni in un unico posto.' },
          ].map(p => (
            <div key={p.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: 'rgba(245,158,11,0.28)', flexShrink: 0, lineHeight: 1 }}>{p.n}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#e8edf5', marginBottom: 2 }}>{p.tit}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer panel */}
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginBottom: 12 }}>Non hai ancora un account?</p>
          <Link
            to="/register"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 8,
              border: '1px solid rgba(245,158,11,0.3)', color: 'var(--accent)',
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              background: 'rgba(245,158,11,0.05)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; }}
          >
            Crea Account →
          </Link>
        </div>
      </div>

      {/* ── Panel destro — form ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px' }}>

        {/* Logo mobile */}
        <div className="lg:hidden" style={{ marginBottom: 32, textAlign: 'center' }}>
          <img src="/dbi-logo.png" alt="Daniel Balloi Immobiliare"
            style={{ height: 44, objectFit: 'contain', margin: '0 auto 8px' }} />
        </div>

        {/* Card form */}
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          borderRadius: 16,
          padding: '40px 40px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* Logo DBI centrato sopra il form — desktop */}
          <div className="hidden lg:flex" style={{ justifyContent: 'center', marginBottom: 28 }}>
            <img src="/dbi-logo.png" alt="Daniel Balloi Immobiliare" style={{ height: 40, objectFit: 'contain' }} />
          </div>

          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Bentornato
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Inserisci le tue credenziali per accedere
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <InputField
              label="Email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tua@email.it"
              autoComplete="email"
              disabled={loading}
            />

            <InputField
              label="Password"
              type={showPwd ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            >
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPwd ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </InputField>

            {errore && (
              <div style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--danger-dim)',
                border: '1px solid rgba(244,63,94,0.2)',
                fontSize: 13,
                color: 'var(--danger)',
                textAlign: 'center',
              }}>
                {errore}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 10,
                border: 'none',
                background: loading ? 'rgba(245,158,11,0.4)' : 'var(--accent)',
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--accent)'; }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.99)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? 'Accesso in corso…' : 'Accedi →'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>oppure</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <p style={{ fontSize: 13, textAlign: 'center', color: 'var(--text-muted)' }}>
            Non hai un account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
