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
import { getImportStats, inviaSegnalazione } from '../services/api';

function ModalRichiestaInviata({ onChiudi }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65" onClick={onChiudi} />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Richiesta Inviata
            </h2>
          </div>
          <button
            onClick={onChiudi}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-muted)' }}>
            La tua segnalazione è stata inviata con successo. L'amministratore ti risponderà via email all'indirizzo registrato.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onChiudi}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Impostazioni() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [dbStats, setDbStats]           = useState(null);
  const [loading, setLoading]           = useState(true);

  // Segnalazione form
  const [segnOggetto, setSegnOggetto]   = useState('');
  const [segnMessaggio, setSegnMessaggio] = useState('');
  const [segnInvio, setSegnInvio]       = useState(false); // in corso
  const [segnEsito, setSegnEsito]       = useState(null);  // 'ok' | 'errore'

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

  async function inviaSegnalazioneForm(e) {
    e.preventDefault();
    if (!segnMessaggio.trim()) return;
    setSegnInvio(true);
    setSegnEsito(null);
    try {
      await inviaSegnalazione({ oggetto: segnOggetto || 'Segnalazione', messaggio: segnMessaggio });
      console.log('[IMPOSTAZIONI] Segnalazione inviata');
      setSegnEsito('ok');
      setSegnOggetto('');
      setSegnMessaggio('');
    } catch (err) {
      console.error('[IMPOSTAZIONI] Errore invio segnalazione:', err);
      setSegnEsito('errore');
    } finally {
      setSegnInvio(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {segnEsito === 'ok' && (
        <ModalRichiestaInviata onChiudi={() => setSegnEsito(null)} />
      )}

      {/* Intestazione */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Impostazioni</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Configurazione e stato del sistema</p>
      </div>

      {/* ── Stato Sistema ───────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Stato Sistema</h2>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Verifica in corso...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  label: 'Backend Express (porta 5000)',
                  ok: !!healthStatus,
                  text: healthStatus ? 'Connesso' : 'Non raggiungibile',
                },
                {
                  label: 'Database MySQL (omi)',
                  ok: !!dbStats,
                  text: dbStats ? `Connesso · ${Number(dbStats.totale_valori).toLocaleString()} record` : 'Non raggiungibile',
                },
              ].map(({ label, ok, text }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8, flexShrink: 0, background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: ok ? 'var(--success)' : 'var(--danger)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#10b981' : '#ef4444' }} />
                    {text}
                  </span>
                </div>
              ))}
              {healthStatus && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }}>
                  Ultimo check: {new Date(healthStatus.timestamp).toLocaleString('it-IT')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Database OMI ────────────────────────────────────────────────── */}
      {dbStats && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Database OMI</h2>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
              {[
                { val: Number(dbStats.totale_valori).toLocaleString(), label: 'Record Valori',   color: 'var(--accent)' },
                { val: dbStats.totale_zone,                            label: 'Zone Mappate',    color: 'var(--text-primary)' },
                { val: dbStats.anni_disponibili?.[0] ?? '–',           label: 'Anno Più Recente',color: 'var(--text-primary)' },
              ].map(({ val, label, color }) => (
                <div key={label} style={{ padding: '16px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                  <p style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1, marginBottom: 8 }}>{val}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{label}</p>
                </div>
              ))}
            </div>
            {dbStats.anni_disponibili?.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                Annate disponibili: {dbStats.anni_disponibili.join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Connessione Database ────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Connessione Database</h2>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'monospace' }}>
            {[
              { k: 'Host',     v: 'localhost' },
              { k: 'Porta',    v: '3306' },
              { k: 'Database', v: 'omi' },
              { k: 'Utente',   v: 'root' },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                <span style={{ width: 72, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            Modifica le credenziali nel file{' '}
            <code style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>backend/.env</code>
          </p>
        </div>
      </div>

      {/* ── Segnala un Problema ─────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>Segnala un Problema</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Invia una segnalazione o un bug report all'amministratore. L'admin risponderà via email all'indirizzo con cui sei registrato.
          </p>
        </div>
        <div style={{ padding: '24px' }}>
          <form onSubmit={inviaSegnalazioneForm} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {segnEsito === 'errore' && (
                <p style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Errore durante l'invio. Riprova.
                </p>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.01em' }}>Oggetto</label>
                <input
                  value={segnOggetto}
                  onChange={e => setSegnOggetto(e.target.value)}
                  placeholder="Es. Bug nella dashboard, Richiesta funzionalità…"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.01em' }}>Messaggio *</label>
                <textarea
                  required
                  value={segnMessaggio}
                  onChange={e => setSegnMessaggio(e.target.value)}
                  rows={5}
                  placeholder="Descrivi il problema o la richiesta nel dettaglio…"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button
                  type="submit"
                  disabled={segnInvio || !segnMessaggio.trim()}
                  style={{ padding: '12px 32px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: segnInvio ? 'not-allowed' : 'pointer', opacity: (segnInvio || !segnMessaggio.trim()) ? 0.5 : 1 }}
                >
                  {segnInvio ? 'Invio in corso…' : 'Invia Segnalazione'}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
}
