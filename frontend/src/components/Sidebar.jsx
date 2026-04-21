/**
 * Sidebar - Menu di navigazione laterale
 *
 * Le voci del menu dipendono dal ruolo:
 *   USER:  Analisi, Portafoglio, Sistema
 *   ADMIN: Analisi, Dati (Import), Portafoglio, Sistema, Amministrazione (Utenze)
 *
 * Per l'admin: polling ogni 30s sul conteggio utenze pending.
 * Se ci sono richieste in attesa → pallino rosso animato a fianco di "Utenze".
 */

import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// ── Sezioni menu base (tutti gli utenti) ──────────────────────────────────
const SEZIONI_BASE = [
  {
    label: 'ANALISI',
    items: [
      {
        to: '/',
        label: 'Dashboard Mappa',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ),
      },
      {
        to: '/statistiche',
        label: 'Statistiche Quartiere & Comune',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'PORTAFOGLIO',
    items: [
      {
        to: '/valutazione',
        label: 'Wizard Valutazione',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        to: '/portafoglio',
        label: 'I Miei Investimenti',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      {
        to: '/impostazioni',
        label: 'Impostazioni',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

// ── Sezioni solo admin ─────────────────────────────────────────────────────
const SEZIONI_ADMIN = [
  {
    label: 'DATI',
    items: [
      {
        to: '/import',
        label: 'Import Dati',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'AMMINISTRAZIONE',
    items: [
      {
        to: '/utenze',
        label: 'Utenze',
        // hasBadge: true → il rendering usa pendingCount per mostrare il pallino
        hasBadge: true,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
    ],
  },
];

// ── Intervallo polling in ms ───────────────────────────────────────────────
// 30s di norma; quando si è sulla pagina /utenze si aggiorna ogni 10s
// così il badge sparisce subito dopo aver approvato/rifiutato
const POLL_NORMAL  = 30_000;
const POLL_ON_PAGE = 10_000;

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin  = user?.ruolo === 'admin';

  // Conteggio richieste pending — solo per admin
  const [pendingCount, setPendingCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Non avviare il polling se non admin
    if (!isAdmin) return;

    // Fetch immediato al mount
    async function fetchPending() {
      try {
        const { data } = await api.get('/utenze');
        const count = data.conteggi?.pending ?? 0;
        setPendingCount(count);
        if (count > 0) {
          console.log(`[SIDEBAR] ${count} utenz${count === 1 ? 'a' : 'e'} in attesa di approvazione`);
        }
      } catch {
        // Silenzioso: l'errore di rete non deve rompere la UI
      }
    }

    fetchPending();

    // Intervallo adattivo: più frequente quando l'admin è già su /utenze
    const delay = location.pathname === '/utenze' ? POLL_ON_PAGE : POLL_NORMAL;
    intervalRef.current = setInterval(fetchPending, delay);

    // Pulizia al cambio di pathname o all'unmount
    return () => clearInterval(intervalRef.current);
  }, [isAdmin, location.pathname]);

  // Menu completo in base al ruolo
  const sezioni = isAdmin
    ? [...SEZIONI_BASE.slice(0, 1), ...SEZIONI_ADMIN, ...SEZIONI_BASE.slice(1)]
    : SEZIONI_BASE;

  return (
    <aside
      className={`
        fixed lg:relative z-30 flex flex-col h-full w-56 shrink-0
        transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div
          className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-xs"
          style={{ background: 'var(--accent)' }}
        >
          B
        </div>
        <div>
          <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Balloi</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Immobiliare</div>
        </div>
        <button onClick={onClose} className="ml-auto lg:hidden" style={{ color: 'var(--text-muted)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Voci menu ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {sezioni.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-2 mb-1 text-xs font-semibold tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {section.label}
            </p>

            {section.items.map((item) => {
              // Mostra badge rosso solo sulla voce Utenze quando ci sono pending
              const showBadge = item.hasBadge && pendingCount > 0;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) => `
                    flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm
                    transition-colors duration-150 no-underline
                    ${isActive ? 'font-medium' : 'hover:opacity-90'}
                  `}
                  style={({ isActive }) => ({
                    background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  })}
                >
                  {/* Icona */}
                  <span className="shrink-0">{item.icon}</span>

                  {/* Label */}
                  <span className="flex-1 leading-none">{item.label}</span>

                  {/* ── Badge pallino rosso pending ──────────────────── */}
                  {showBadge && (
                    <span className="flex items-center gap-1 shrink-0">
                      {/* Numero richieste */}
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ background: '#ef4444', color: '#fff', fontSize: '10px' }}
                      >
                        {pendingCount}
                      </span>
                      {/* Pallino animato — richiama l'attenzione */}
                      <span
                        className="animate-pulse w-2 h-2 rounded-full"
                        style={{ background: '#ef4444' }}
                        title={`${pendingCount} richiesta${pendingCount > 1 ? 'e' : ''} in attesa`}
                      />
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer: utente + logout ───────────────────────────────────── */}
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {user && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'var(--accent)', color: '#0f1117' }}
            >
              {(user.nome?.[0] ?? user.username?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user.nome && user.cognome
                  ? `${user.nome} ${user.cognome}`
                  : (user.username ?? user.email)}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                {isAdmin ? 'Amministratore' : 'Utente'}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 hover:opacity-90"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium">Logout</span>
        </button>

        <p className="text-center mt-2" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          v1.0.0 · Dati OMI Cagliari
        </p>
      </div>
    </aside>
  );
}
