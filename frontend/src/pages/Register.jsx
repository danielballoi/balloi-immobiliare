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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Icona orologio */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(245,158,11,0.15)' }}
        >
          <svg className="w-8 h-8" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Richiesta inviata!
        </h2>
        <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
          La tua richiesta di registrazione è stata ricevuta ed è in attesa di approvazione da parte
          dell'amministratore.
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Riceverai accesso alla piattaforma non appena il tuo account verrà attivato.
        </p>

        <div
          className="rounded-xl px-4 py-3 text-sm mb-6"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}
        >
          Il tuo account è <strong>in attesa di approvazione</strong>.<br />
          Contatta l'amministratore per velocizzare il processo.
        </div>

        <Link
          to="/login"
          className="block w-full py-3 rounded-lg text-sm font-bold text-center transition-all"
          style={{ background: 'var(--accent)', color: '#0f1117' }}
          onClick={onClose}
        >
          Torna al Login
        </Link>
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

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
  };

  return (
    <>
      {/* Popup pending — appare sopra tutto dopo registrazione riuscita */}
      {registrato && <PopupPending onClose={() => setRegistrato(false)} />}

      <div className="min-h-screen flex" style={{ background: '#080b12' }}>

        {/* ══════════════════════════════════════════════════════════════
            PANNELLO SINISTRO — form registrazione
        ══════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'var(--accent)' }}
            >
              B
            </div>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Balloi Immobiliare</span>
          </div>

          <div
            className="w-full max-w-md rounded-2xl p-8"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* Logo desktop */}
            <div className="hidden lg:flex items-center justify-center gap-2 mb-5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ background: 'var(--accent)' }}
              >
                B
              </div>
              <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Balloi Immobiliare
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1 text-center" style={{ color: 'var(--text-primary)' }}>
              Crea Account
            </h2>
            <p className="text-xs text-center mb-5" style={{ color: 'var(--text-muted)' }}>
              Compila il modulo — l'accesso sarà attivo dopo l'approvazione dell'admin
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* Nome + Cognome side-by-side */}
              <div className="grid grid-cols-2 gap-3 mb-4">
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
              <div className="mb-4">
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
              <div className="mb-4">
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
              <div className="mb-3">
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
              <div className="mb-5">
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
                className="w-full py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: loading ? 'rgba(245,158,11,0.5)' : 'var(--accent)',
                  color: '#0f1117',
                  cursor: loading ? 'not-allowed' : 'pointer',
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

        {/* ══════════════════════════════════════════════════════════════
            PANNELLO DESTRO — pitch
        ══════════════════════════════════════════════════════════════ */}
        <div
          className="hidden lg:flex flex-col justify-between w-5/12 p-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f1117 0%, #1a1d27 60%, #0d1117 100%)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 80% 50%, rgba(245,158,11,0.08) 0%, transparent 60%), radial-gradient(ellipse at 20% 20%, rgba(59,130,246,0.05) 0%, transparent 50%)',
            }}
          />

          <div className="relative flex items-center gap-2.5 justify-end">
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

          <div className="relative text-right">
            <p className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
              COME FUNZIONA
            </p>
            <h1 className="text-3xl font-bold leading-tight mb-6" style={{ color: 'var(--text-primary)' }}>
              Investi su<br />
              <span style={{ color: 'var(--accent)' }}>Cagliari.</span><br />
              & hinterland.
            </h1>

            {/* Passi registrazione */}
            {[
              { n: '01', tit: 'Compila il modulo',   desc: 'Inserisci i tuoi dati di accesso' },
              { n: '02', tit: 'Attendi approvazione', desc: "L'admin verifica e attiva il tuo account" },
              { n: '03', tit: 'Accedi alla piattaforma', desc: 'Analizza prezzi e valuta investimenti' },
            ].map(p => (
              <div key={p.n} className="flex items-start gap-4 mb-5 text-left">
                <span className="text-2xl font-black shrink-0" style={{ color: 'rgba(245,158,11,0.3)' }}>{p.n}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.tit}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative text-right">
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Hai già un account?</p>
            <Link
              to="/login"
              className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}
            >
              ← Accedi
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
