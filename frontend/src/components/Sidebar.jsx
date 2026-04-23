/**
 * Sidebar — Daniel Balloi Immobiliare
 * Design: Linear-inspired, ultra-minimal dark sidebar
 */

import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

/* ── Icone SVG ──────────────────────────────────────────────────── */
const IconMap      = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l7-7 7 7"/><path d="M5 8.5V17h4v-4h2v4h4V8.5"/></svg>;
const IconWizard   = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M14 14h.01M11 14h3m0 0v-3"/></svg>;
const IconPortfolio = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V8l7-5 7 5v9"/><path d="M8 17v-5h4v5"/></svg>;
const IconSettings = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="2.5"/><path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.22 4.22l1.06 1.06M14.72 14.72l1.06 1.06M4.22 15.78l1.06-1.06M14.72 5.28l1.06-1.06"/></svg>;
const IconImport   = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M10 3v10m0 0l-3-3m3 3l3-3"/><path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2"/></svg>;
const IconUsers    = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="6.5" r="2.5"/><path d="M1 17c0-3.3 2.9-6 6.5-6S14 13.7 14 17"/><circle cx="14.5" cy="6.5" r="2.5"/><path d="M16 11.2c1.9.7 3.2 2.5 3.2 4.6"/></svg>;
const IconLogout   = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4"/><path d="M8 14l4-4-4-4"/><path d="M12 10H2"/></svg>;
const IconChevronLeft  = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l-5 5 5 5"/></svg>;
const IconChevronRight = () => <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M8 5l5 5-5 5"/></svg>;

/* ── Struttura navigazione ──────────────────────────────────────── */
const SEZIONI_BASE = [
  {
    id: 'analisi',
    label: 'Analisi',
    items: [
      { to: '/', label: 'Dashboard Mappa', Icon: IconMap },
    ],
  },
  {
    id: 'portafoglio',
    label: 'Portafoglio',
    items: [
      { to: '/valutazione', label: 'Wizard Valutazione', Icon: IconWizard },
      { to: '/portafoglio', label: 'I Miei Investimenti', Icon: IconPortfolio },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { to: '/impostazioni', label: 'Impostazioni', Icon: IconSettings },
    ],
  },
];

const SEZIONI_ADMIN = [
  {
    id: 'dati',
    label: 'Dati',
    items: [
      { to: '/import', label: 'Import Dati', Icon: IconImport },
    ],
  },
  {
    id: 'admin',
    label: 'Amministrazione',
    items: [
      { to: '/utenze', label: 'Utenze', Icon: IconUsers, hasBadge: true },
    ],
  },
];

const POLL_MS = 30_000;

export default function Sidebar({ isOpen, onToggle }) {
  const { user, logout } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const isAdmin    = user?.ruolo === 'admin';

  const [badge, setBadge]       = useState(0);
  const intervalRef             = useRef(null);

  /* Polling badge admin (pending + messaggi) */
  useEffect(() => {
    if (!isAdmin) return;
    async function fetch() {
      try {
        const { data } = await api.get('/utenze');
        setBadge((data.conteggi?.pending ?? 0) + (data.conteggi?.messaggi_nuovi ?? 0));
      } catch { /* silenzioso */ }
    }
    fetch();
    intervalRef.current = setInterval(fetch, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [isAdmin, location.pathname]);

  const sezioni = isAdmin
    ? [...SEZIONI_BASE.slice(0, 1), ...SEZIONI_ADMIN, ...SEZIONI_BASE.slice(1)]
    : SEZIONI_BASE;

  const initiali = ((user?.nome ?? user?.username ?? '?')[0] ?? '?').toUpperCase();

  return (
    <>
      {/* ── Sidebar principale ─────────────────────────────────────── */}
      <aside
        style={{
          width: isOpen ? 'var(--sidebar-width)' : 'var(--sidebar-width-sm)',
          minWidth: isOpen ? 'var(--sidebar-width)' : 'var(--sidebar-width-sm)',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          flexShrink: 0,
          transition: 'width 0.2s ease, min-width 0.2s ease',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 30,
        }}
      >

        {/* ── Header: logo + toggle ─────────────────────────────────── */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: isOpen ? '0 12px 0 14px' : '0 12px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            gap: 10,
          }}
        >
          {/* Logo DBI — sostituisce il vecchio monogramma DB */}
          <button
            onClick={() => navigate('/')}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              padding: 0,
            }}
            title="Dashboard"
          >
            <img
              src="/dbi-logo.png"
              alt="DBI"
              style={{ width: 32, height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </button>

          {/* Testo marca — visibile solo aperto */}
          {isOpen && (
            <button
              onClick={() => navigate('/')}
              style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Daniel Balloi
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginTop: 1 }}>
                Immobiliare
              </div>
            </button>
          )}

          {/* Toggle freccia */}
          <button
            onClick={onToggle}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title={isOpen ? 'Chiudi sidebar' : 'Apri sidebar'}
            aria-label={isOpen ? 'Chiudi sidebar' : 'Apri sidebar'}
          >
            <span style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isOpen ? <IconChevronLeft /> : <IconChevronRight />}
            </span>
          </button>
        </div>

        {/* ── Navigazione ───────────────────────────────────────────── */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
          {sezioni.map(sezione => (
            <div key={sezione.id} style={{ marginBottom: 8 }}>
              {/* Label sezione — solo sidebar aperta */}
              {isOpen && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '4px 8px 4px',
                  marginBottom: 2,
                }}>
                  {sezione.label}
                </div>
              )}

              {sezione.items.map(item => {
                const hasBadge = item.hasBadge && badge > 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: isOpen ? '7px 10px' : '7px',
                      borderRadius: 8,
                      marginBottom: 2,
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      background: isActive ? 'rgba(245,158,11,0.08)' : 'transparent',
                      border: '1px solid transparent',
                      borderColor: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                      position: 'relative',
                      transition: 'all 0.12s ease',
                      justifyContent: isOpen ? 'flex-start' : 'center',
                    })}
                    onMouseEnter={e => {
                      if (!e.currentTarget.style.background.includes('245,158,11')) {
                        e.currentTarget.style.background = 'var(--bg-elevated)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={e => {
                      const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                    title={!isOpen ? item.label : undefined}
                  >
                    {/* Icona */}
                    <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.Icon />
                    </span>

                    {/* Label + badge */}
                    {isOpen && (
                      <>
                        <span style={{ flex: 1, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                        {hasBadge && (
                          <span style={{
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px',
                          }}>
                            {badge}
                          </span>
                        )}
                      </>
                    )}

                    {/* Badge puntino quando collassata */}
                    {!isOpen && hasBadge && (
                      <span style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#ef4444',
                      }} />
                    )}
                  </NavLink>
                );
              })}

              {/* Separatore tra sezioni */}
              {isOpen && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />}
            </div>
          ))}
        </nav>

        {/* ── Footer: utente + logout ───────────────────────────────── */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 8px',
          flexShrink: 0,
        }}>
          {/* Logout */}
          <button
            onClick={logout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: isOpen ? '7px 10px' : '7px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              justifyContent: isOpen ? 'flex-start' : 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)'; e.currentTarget.style.color = '#f43f5e'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title={!isOpen ? 'Logout' : undefined}
          >
            <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconLogout />
            </span>
            {isOpen && <span style={{ fontWeight: 500 }}>Esci</span>}
          </button>

          {isOpen && (
            <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.03em' }}>
              v1.0 · Dati OMI Cagliari
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
