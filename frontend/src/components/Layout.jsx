/**
 * Layout - Struttura principale dell'applicazione
 *
 * Questo componente definisce lo "scheletro" visivo dell'app:
 * - Sidebar a sinistra (navigazione)
 * - Area di contenuto a destra (dove vengono renderizzate le pagine)
 *
 * React Router renderizza le pagine nell'<Outlet />,
 * che è il "segnaposto" dove appare il contenuto della route attiva.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  // Stato per il menu mobile (collassato/espanso su schermi piccoli)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Overlay mobile: sfondo scuro quando sidebar è aperta ─────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar sinistra ──────────────────────────────────────────────── */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Area principale (header + contenuto pagina) ───────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Header mobile: mostra il pulsante hamburger solo su schermi piccoli */}
        <header
          className="flex items-center gap-3 px-4 py-3 border-b lg:hidden"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Apri menu"
          >
            {/* Icona hamburger (3 linee) */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>Balloi Imm.</span>
        </header>

        {/* ── Contenuto pagina: scrollabile indipendentemente dalla sidebar ── */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          {/* Outlet è il punto dove React Router inserisce la pagina attiva */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
