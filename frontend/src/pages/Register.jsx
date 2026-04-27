/**
 * Register.jsx - Pagina di registrazione
 *
 * Campi richiesti: Nome, Cognome, Username, Email, Password, Conferma password.
 * Dopo la submit riuscita: l'account è in stato 'pending'.
 * Viene mostrato un popup che informa l'utente di attendere l'approvazione admin.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

// Indicatori requisiti password visualizzati in real-time
const REQUISITI_PWD = [
  { label: 'Almeno 8 caratteri',   test: pwd => pwd.length >= 8 },
  { label: '1 lettera maiuscola',   test: pwd => /[A-Z]/.test(pwd) },
  { label: '1 numero',              test: pwd => /[0-9]/.test(pwd) },
  { label: '1 carattere speciale',  test: pwd => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) },
];

// ── Popup "registrazione in attesa" ───────────────────────────────────────
function PopupPending({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', padding: '24px 16px' }}
    >
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{ maxWidth: 480, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
      >
        {/* Header con icona */}
        <div style={{ padding: '36px 40px 28px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <svg width="28" height="28" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
            Richiesta inviata
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
            La tua richiesta di registrazione è stata ricevuta ed è in attesa di approvazione da parte dell'amministratore.
          </p>
        </div>

        {/* Corpo */}
        <div style={{ padding: '28px 40px' }}>
          <div style={{
            borderRadius: 12, padding: '16px 20px',
            background: 'rgba(245,158,11,0.07)',
            border: '1px solid rgba(245,158,11,0.18)',
            marginBottom: 28,
          }}>
            <p style={{ fontSize: 13, color: '#f59e0b', lineHeight: 1.7, margin: 0 }}>
              Il tuo account è attualmente <strong>in attesa di approvazione</strong>.
              Riceverai accesso non appena l'amministratore attiverà il profilo.
            </p>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28, opacity: 0.8 }}>
            Puoi contattare l'amministratore per velocizzare il processo di attivazione.
          </p>

          <Link
            to="/login"
            onClick={onClose}
            style={{
              display: 'block', width: '100%', padding: '13px 0',
              borderRadius: 10, textAlign: 'center',
              fontSize: 14, fontWeight: 700, letterSpacing: '0.01em',
              background: 'var(--accent)', color: '#0f1117',
              textDecoration: 'none',
            }}
          >
            Torna al Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState({
    nome: '', cognome: '', username: '', email: '', password: '', confermaPassword: '',
  });
  const [errore, setErrore]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [mostraPwd, setMostraPwd] = useState(false);
  const [registrato, setRegistrato] = useState(false); // true → mostra popup pending

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrore('');
  }

  function valida() {
    if (!form.nome || !form.cognome || !form.username || !form.email || !form.password || !form.confermaPassword) {
      return 'Tutti i campi sono obbligatori';
    }
    if (form.nome.trim().length < 2)    return 'Nome non valido (min 2 caratteri)';
    if (form.cognome.trim().length < 2)  return 'Cognome non valido (min 2 caratteri)';
    if (form.username.trim().length < 3) return 'Username troppo corto (min 3 caratteri)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) return 'Email non valida';
    if (REQUISITI_PWD.some(r => !r.test(form.password))) return 'La password non soddisfa i requisiti';
    if (form.password !== form.confermaPassword) return 'Le password non coincidono';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errValidazione = valida();
    if (errValidazione) { setErrore(errValidazione); return; }

    setLoading(true);
    setErrore('');

    try {
      await api.post('/auth/register', {
        nome:     form.nome.trim(),
        cognome:  form.cognome.trim(),
        username: form.username.trim(),
        email:    form.email.trim(),
        password: form.password,
      });

      // Registrazione OK → mostra popup pending (nessun token, nessun redirect dashboard)
      setRegistrato(true);
      console.log('[REGISTER] Richiesta inviata in pending:', form.email);
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Errore durante la registrazione';
      setErrore(msg);
    } finally {
      setLoading(false);
    }
  }

  // Padding aumentato per altezza moderna (12/16px) — coerente con Login
  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    padding: '12px 16px',
  };

  return (
    <>
      {/* Popup pending — appare sopra tutto dopo registrazione riuscita */}
      {registrato && <PopupPending onClose={() => setRegistrato(false)} />}

      <div className="min-h-screen flex" style={{ background: '#080b12' }}>

        {/* ══════════════════════════════════════════════════════════════
            PANNELLO SINISTRO — brand/pitch (identico a Login per coerenza)
        ══════════════════════════════════════════════════════════════ */}
        <div
          className="hidden lg:flex flex-col justify-between"
          style={{
            width: '50%',
            padding: '48px 56px',
            background: 'linear-gradient(145deg, #0a0f1a 0%, #0f1520 50%, #080b12 100%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Glow decorativo */}
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)', top: '8%', left: '-15%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)', bottom: '15%', right: '-8%', pointerEvents: 'none' }} />

          {/* Logo DBI */}
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

            {[
              { n: '01', tit: 'Compila il modulo',       desc: 'Inserisci i tuoi dati — pochi campi, tutto chiaro.' },
              { n: '02', tit: 'Attendi approvazione',     desc: "L'admin verifica e attiva il tuo account entro 24h." },
              { n: '03', tit: 'Accedi alla piattaforma',  desc: 'Analizza prezzi OMI e valuta investimenti a Cagliari.' },
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
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginBottom: 12 }}>Hai già un account?</p>
            <Link
              to="/login"
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
              ← Accedi
            </Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            PANNELLO DESTRO — form registrazione
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px' }}>

          {/* Logo mobile */}
          <div className="lg:hidden" style={{ marginBottom: 32, textAlign: 'center' }}>
            <img src="/dbi-logo.png" alt="Daniel Balloi Immobiliare"
              style={{ height: 44, objectFit: 'contain', margin: '0 auto 8px' }} />
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              padding: '40px 40px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Logo DBI centrato sopra il form — desktop */}
            <div className="hidden lg:flex" style={{ justifyContent: 'center', marginBottom: 28 }}>
              <img src="/dbi-logo.png" alt="Daniel Balloi Immobiliare" style={{ height: 40, objectFit: 'contain' }} />
            </div>

            <h2 className="text-2xl font-bold mb-1 text-center" style={{ color: 'var(--text-primary)' }}>
              Crea Account
            </h2>
            <p className="text-xs text-center mb-6" style={{ color: 'var(--text-muted)' }}>
              Compila il modulo — l'accesso sarà attivo dopo l'approvazione dell'admin
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* Nome + Cognome affiancati — gap 16px, margine inferiore 20px */}
              <div className="grid grid-cols-2 gap-4 mb-5" style={{ marginBottom: 20 }}>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Nome <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={form.nome}
                    onChange={handleChange}
                    autoComplete="given-name"
                    placeholder="Mario"
                    disabled={loading}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Cognome <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="cognome"
                    value={form.cognome}
                    onChange={handleChange}
                    autoComplete="family-name"
                    placeholder="Rossi"
                    disabled={loading}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>

              {/* Username */}
              <div style={{ marginBottom: 20 }}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Username <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  placeholder="mario_rossi"
                  disabled={loading}
                  maxLength={30}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 20 }}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Email <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="mario@email.it"
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={mostraPwd ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full px-4 py-2.5 pr-11 rounded-lg text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                  />
                  <button
                    type="button"
                    onClick={() => setMostraPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label="Toggle visibilità"
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

              {/* Requisiti password */}
              {form.password && (
                <div className="mb-4 grid grid-cols-2 gap-1">
                  {REQUISITI_PWD.map(r => (
                    <div key={r.label} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: r.test(form.password) ? 'var(--success)' : 'var(--border)' }}
                      />
                      <span className="text-xs" style={{ color: r.test(form.password) ? 'var(--success)' : 'var(--text-muted)', fontSize: '11px' }}>
                        {r.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Conferma password */}
              <div style={{ marginBottom: 20 }}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Conferma Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="password"
                  name="confermaPassword"
                  value={form.confermaPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
                {form.confermaPassword && form.confermaPassword !== form.password && (
                  <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Le password non coincidono</p>
                )}
              </div>

              {/* Errore */}
              {errore && (
                <div
                  className="mb-4 px-4 py-3 rounded-lg text-sm text-center"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                >
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
                  fontSize: 14,
                  fontWeight: 700,
                  border: 'none',
                  background: loading ? 'rgba(245,158,11,0.5)' : 'var(--accent)',
                  color: '#0f1117',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Invio richiesta…' : 'Invia Richiesta di Registrazione →'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>oppure</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Hai già un account?{' '}
              <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                Accedi
              </Link>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
