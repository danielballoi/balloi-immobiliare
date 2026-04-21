/**
 * Utenze.jsx - Gestione utenti (solo admin)
 *
 * Mostra tutti gli utenti con i loro stati.
 * L'admin può:
 *   - Approvare richieste pending (→ attivo)
 *   - Bloccare utenti attivi
 *   - Riattivare utenti bloccati
 *   - Eliminare utenti
 *
 * I badge colorati in alto mostrano i conteggi per stato.
 * La tab attiva filtra la lista.
 */

import { useState, useEffect, useCallback } from 'react';
import { getUtenze, approvaUtente, bloccaUtente, riattivaUtente, eliminaUtente } from '../services/api';

// ── Badge di stato ─────────────────────────────────────────────────────────
function BadgeStato({ stato }) {
  const cfg = {
    pending:  { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b',  label: 'In attesa' },
    attivo:   { bg: 'rgba(16,185,129,0.15)',   color: '#10b981',  label: 'Attivo' },
    bloccato: { bg: 'rgba(239,68,68,0.15)',    color: '#ef4444',  label: 'Bloccato' },
  };
  const c = cfg[stato] ?? cfg.bloccato;
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

// ── Popup conferma ─────────────────────────────────────────────────────────
function ModalConferma({ titolo, messaggio, onConferma, onAnnulla, pericoloso }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{titolo}</h3>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{messaggio}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onAnnulla}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}
          >
            Annulla
          </button>
          <button
            onClick={onConferma}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: pericoloso ? 'var(--danger)' : 'var(--accent)', color: '#fff' }}
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabs filtro stato ──────────────────────────────────────────────────────
const TABS = [
  { value: 'tutti',    label: 'Tutti' },
  { value: 'pending',  label: 'In attesa' },
  { value: 'attivo',   label: 'Attivi' },
  { value: 'bloccato', label: 'Bloccati' },
];

export default function Utenze() {
  const [utenti, setUtenti]       = useState([]);
  const [conteggi, setConteggi]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [errore, setErrore]       = useState('');
  const [tabAttiva, setTabAttiva] = useState('tutti');
  const [conferma, setConferma]   = useState(null); // { id, azione, email }
  const [feedback, setFeedback]   = useState('');   // messaggio successo/errore

  // ── Carica lista utenti ───────────────────────────────────────────────
  const caricaUtenti = useCallback(async () => {
    setLoading(true);
    setErrore('');
    try {
      const data = await getUtenze();
      setUtenti(data.utenti);
      setConteggi(data.conteggi);
      console.log('[UTENZE] Lista caricata:', data.conteggi);
    } catch (err) {
      setErrore('Errore nel caricamento utenti');
      console.error('[UTENZE] Errore:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { caricaUtenti(); }, [caricaUtenti]);

  // ── Esegue azione su utente (dopo conferma) ───────────────────────────
  async function eseguiAzione() {
    if (!conferma) return;
    const { id, azione } = conferma;
    setConferma(null);

    try {
      let msg = '';
      if (azione === 'approva')  { await approvaUtente(id);  msg = 'Utente approvato con successo'; }
      if (azione === 'blocca')   { await bloccaUtente(id);   msg = 'Utente bloccato'; }
      if (azione === 'riattiva') { await riattivaUtente(id); msg = 'Utente riattivato'; }
      if (azione === 'elimina')  { await eliminaUtente(id);  msg = 'Utente eliminato'; }

      setFeedback(msg);
      setTimeout(() => setFeedback(''), 3000);
      caricaUtenti(); // ricarica la lista aggiornata
    } catch (err) {
      setFeedback('Errore: ' + (err.response?.data?.error ?? err.message));
      setTimeout(() => setFeedback(''), 4000);
    }
  }

  // ── Filtra utenti per tab ─────────────────────────────────────────────
  const utentiFiltrati = tabAttiva === 'tutti'
    ? utenti
    : utenti.filter(u => u.stato === tabAttiva);

  // ── Formatta data ─────────────────────────────────────────────────────
  const formatData = (d) => d
    ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '–';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Caricamento utenti…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Intestazione ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold tracking-wider mb-1" style={{ color: 'var(--accent)' }}>
          AMMINISTRAZIONE
        </p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestione Utenze</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Approva le richieste di registrazione e gestisci gli accessi alla piattaforma.
        </p>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Totale utenti', valore: conteggi.totale ?? 0, colore: 'var(--info)' },
          { label: 'In attesa',     valore: conteggi.pending ?? 0, colore: 'var(--warning)', urgente: (conteggi.pending ?? 0) > 0 },
          { label: 'Attivi',        valore: conteggi.attivo ?? 0,  colore: 'var(--success)' },
          { label: 'Bloccati',      valore: conteggi.bloccato ?? 0, colore: 'var(--danger)' },
        ].map(k => (
          <div
            key={k.label}
            className="rounded-xl p-4"
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${k.urgente ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
            }}
          >
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            <p className="text-3xl font-bold" style={{ color: k.colore }}>{k.valore}</p>
            {k.urgente && (
              <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--warning)' }}>
                Richiede approvazione
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Feedback toast ────────────────────────────────────────────── */}
      {feedback && (
        <div
          className="px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: feedback.startsWith('Errore') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${feedback.startsWith('Errore') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            color: feedback.startsWith('Errore') ? 'var(--danger)' : 'var(--success)',
          }}
        >
          {feedback}
        </div>
      )}

      {/* ── Errore caricamento ────────────────────────────────────────── */}
      {errore && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
          {errore}
          <button onClick={caricaUtenti} className="ml-3 underline text-xs">Riprova</button>
        </div>
      )}

      {/* ── Tabs filtro ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(tab => {
            const attiva = tabAttiva === tab.value;
            const count = tab.value === 'tutti' ? (conteggi.totale ?? 0)
              : (conteggi[tab.value] ?? 0);
            return (
              <button
                key={tab.value}
                onClick={() => setTabAttiva(tab.value)}
                className="px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors"
                style={{
                  color: attiva ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: attiva ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'transparent',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: tab.value === 'pending' && count > 0 ? 'rgba(245,158,11,0.2)' : 'var(--bg-hover)',
                      color: tab.value === 'pending' && count > 0 ? 'var(--warning)' : 'var(--text-muted)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tabella utenti */}
        {utentiFiltrati.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessun utente in questa categoria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Utente', 'Email', 'Stato', 'Registrato il', 'Ultimo accesso', 'Azioni'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {utentiFiltrati.map(u => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    {/* Avatar + nome */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: 'var(--accent)', color: '#0f1117' }}
                        >
                          {(u.nome?.[0] ?? u.username?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {u.nome && u.cognome ? `${u.nome} ${u.cognome}` : u.username}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{u.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</span>
                    </td>

                    {/* Stato */}
                    <td className="px-5 py-4">
                      <BadgeStato stato={u.stato} />
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatData(u.created_at)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatData(u.ultimo_accesso)}</span>
                    </td>

                    {/* Azioni */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Approva — solo se pending */}
                        {u.stato === 'pending' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'approva', email: u.email })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                          >
                            Approva
                          </button>
                        )}

                        {/* Blocca — solo se attivo */}
                        {u.stato === 'attivo' && u.ruolo !== 'admin' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'blocca', email: u.email })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                          >
                            Blocca
                          </button>
                        )}

                        {/* Riattiva — se bloccato */}
                        {u.stato === 'bloccato' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'riattiva', email: u.email })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
                          >
                            Riattiva
                          </button>
                        )}

                        {/* Elimina — mai su admin */}
                        {u.ruolo !== 'admin' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'elimina', email: u.email })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(239,68,68,0.07)', color: 'var(--text-muted)' }}
                          >
                            Elimina
                          </button>
                        )}

                        {/* Admin badge — non modificabile */}
                        {u.ruolo === 'admin' && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— account admin</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modale conferma ───────────────────────────────────────────── */}
      {conferma && (
        <ModalConferma
          titolo={{
            approva:  'Approva account',
            blocca:   'Blocca account',
            riattiva: 'Riattiva account',
            elimina:  'Elimina account',
          }[conferma.azione]}
          messaggio={{
            approva:  `Vuoi attivare l'account di ${conferma.email}? L'utente potrà accedere alla piattaforma.`,
            blocca:   `Vuoi bloccare l'account di ${conferma.email}? L'utente non potrà più accedere.`,
            riattiva: `Vuoi riattivare l'account di ${conferma.email}?`,
            elimina:  `Vuoi eliminare definitivamente l'account di ${conferma.email}? L'operazione non è reversibile.`,
          }[conferma.azione]}
          pericoloso={conferma.azione === 'elimina' || conferma.azione === 'blocca'}
          onConferma={eseguiAzione}
          onAnnulla={() => setConferma(null)}
        />
      )}
    </div>
  );
}
