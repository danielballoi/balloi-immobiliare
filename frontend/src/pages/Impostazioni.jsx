/**
 * Impostazioni - Pagina configurazione applicazione
 *
 * Permette di:
 *   - Verificare lo stato della connessione al backend
 *   - Vedere le informazioni sul database
 *   - Configurare parametri di default per le valutazioni
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getImportStats } from '../services/api';

export default function Impostazioni() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [dbStats, setDbStats]           = useState(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    console.log('[IMPOSTAZIONI] Verifica connessione backend');
    Promise.all([
      axios.get('/api/health').then(r => r.data).catch(() => null),
      getImportStats().catch(() => null),
    ]).then(([health, stats]) => {
      setHealthStatus(health);
      setDbStats(stats);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Impostazioni</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configurazione e stato del sistema</p>
      </div>

      {/* Stato backend */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Stato Sistema</h2>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Verifica in corso...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Backend */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Backend Express (porta 5000)</span>
              <span
                className="flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded"
                style={{
                  background: healthStatus ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: healthStatus ? 'var(--success)' : 'var(--danger)',
                }}
              >
                <span className={`w-2 h-2 rounded-full ${healthStatus ? 'bg-green-500' : 'bg-red-500'}`} />
                {healthStatus ? 'Connesso' : 'Non raggiungibile'}
              </span>
            </div>

            {/* Database */}
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Database MySQL (omi)</span>
              <span
                className="flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded"
                style={{
                  background: dbStats ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: dbStats ? 'var(--success)' : 'var(--danger)',
                }}
              >
                <span className={`w-2 h-2 rounded-full ${dbStats ? 'bg-green-500' : 'bg-red-500'}`} />
                {dbStats ? `Connesso · ${Number(dbStats.totale_valori).toLocaleString()} record` : 'Non raggiungibile'}
              </span>
            </div>

            {healthStatus && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Ultimo check: {new Date(healthStatus.timestamp).toLocaleString('it-IT')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info DB */}
      {dbStats && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Database OMI</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{Number(dbStats.totale_valori).toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Record Valori</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{dbStats.totale_zone}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Zone Mappate</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{dbStats.anni_disponibili?.[0] ?? '–'}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Anno Più Recente</p>
            </div>
          </div>
          {dbStats.anni_disponibili?.length > 0 && (
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Annate disponibili: {dbStats.anni_disponibili.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Configurazione accesso DB */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Connessione Database</h2>
        <div className="flex flex-col gap-2 text-sm font-mono">
          {[
            { k: 'Host',     v: 'localhost' },
            { k: 'Porta',    v: '3306' },
            { k: 'Database', v: 'omi' },
            { k: 'Utente',   v: 'root' },
          ].map(({ k, v }) => (
            <div key={k} className="flex gap-3">
              <span className="w-20" style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ color: 'var(--text-primary)' }}>{v}</span>
            </div>
          ))}
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Modifica le credenziali nel file <code className="px-1 rounded" style={{ background: 'var(--bg-hover)' }}>backend/.env</code>
          </p>
        </div>
      </div>
    </div>
  );
}
