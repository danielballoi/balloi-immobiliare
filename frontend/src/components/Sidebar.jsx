/**
 * Sidebar - Menu di navigazione laterale
 *
 * Contiene i link a tutte le sezioni dell'app.
 * Usa NavLink di React Router che aggiunge automaticamente
 * la classe "active" al link della pagina corrente.
 *
 * Props:
 *   isOpen  - boolean: sidebar visibile su mobile
 *   onClose - funzione: chiude la sidebar su mobile
 */

import { NavLink } from 'react-router-dom';

// ── Definizione voci menu ─────────────────────────────────────────────────
// Raggruppo le voci per sezione per gestire i separatori visivi
const MENU_SECTIONS = [
  {
    label: 'ANALISI',
    items: [
      {
        to: '/',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ),
        label: 'Dashboard Mappa',
      },
      {
        to: '/statistiche',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        label: 'Statistiche Quartiere & Comune',
      },
    ],
  },
  {
    label: 'DATI',
    items: [
      {
        to: '/import',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
        label: 'Import Dati',
      },
      {
        to: '/valutazione',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
        label: 'Wizard Valutazione',
      },
    ],
  },
  {
    label: 'PORTAFOGLIO',
    items: [
      {
        to: '/portafoglio',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        label: 'I Miei Investimenti',
      },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      {
        to: '/impostazioni',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        label: 'Impostazioni',
      },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <aside
      className={`
        fixed lg:relative z-30 flex flex-col h-full w-56 shrink-0
        transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {/* Quadrato colorato come logo semplice */}
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
        {/* Pulsante chiudi su mobile */}
        <button onClick={onClose} className="ml-auto lg:hidden" style={{ color: 'var(--text-muted)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Voci menu ────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {MENU_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            {/* Etichetta sezione */}
            <p className="px-2 mb-1 text-xs font-semibold tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}  // "end" evita che "/" sia attiva su tutte le route
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm
                  transition-colors duration-150 no-underline
                  ${isActive
                    ? 'font-medium'
                    : 'hover:opacity-90'
                  }
                `}
                style={({ isActive }) => ({
                  background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                })}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Footer sidebar ───────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        v1.0.0 · Dati OMI Cagliari
      </div>
    </aside>
  );
}
