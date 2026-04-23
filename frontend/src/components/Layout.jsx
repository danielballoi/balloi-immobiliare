/**
 * Layout — Struttura principale dell'applicazione
 * Header in alto con saluto + Sidebar a sinistra + area contenuto.
 */

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const nomeUtente = user?.nome ?? user?.username ?? 'Utente';
  const isAdmin    = user?.ruolo === 'admin';
  const ora = new Date().getHours();
  const saluto = ora < 12 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const icona  = ora >= 6 && ora < 12 ? '☀️' : ora >= 12 && ora < 18 ? '🌤️' : '🌙';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ── Overlay mobile ──────────────────────────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <div
        style={{
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 30,
          transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.22s ease',
        }}
      >
        <Sidebar
          isOpen={isMobile ? true : sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
        />
      </div>

      {/* ── Area principale ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

        {/* ── Header con saluto ───────────────────────────────────── */}
        <header
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}
        >
          {/* Hamburger mobile */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Apri menu"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M1.5 3.5h12M1.5 7.5h12M1.5 11.5h12" />
              </svg>
            </button>
          )}

          {/* Toggle sidebar desktop — visibile solo quando chiusa */}
          {!isMobile && !sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              aria-label="Apri sidebar"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5l5 5-5 5" />
              </svg>
            </button>
          )}

          {/* Saluto */}
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icona}</span>
            {saluto},{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{nomeUtente}</span>
          </span>

          <div style={{ flex: 1 }} />

          {/* Ruolo + Data */}
          <div style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
              background: isAdmin ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
              color: isAdmin ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${isAdmin ? 'rgba(245,158,11,0.25)' : 'rgba(100,116,139,0.2)'}`,
            }}>
              {isAdmin ? 'Amministratore' : 'Utente'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* ── Contenuto pagina ───────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isMobile ? '20px 16px' : '28px 32px',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
