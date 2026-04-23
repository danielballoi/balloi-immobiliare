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
import { getUtenze, approvaUtente, bloccaUtente, riattivaUtente, eliminaUtente, getSegnalazioni, segnaLetta } from '../services/api';

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
const TABS_UTENTI = [
  { value: 'tutti',    label: 'Tutti' },
  { value: 'pending',  label: 'In attesa' },
  { value: 'attivo',   label: 'Attivi' },
  { value: 'bloccato', label: 'Bloccati' },
];

// ── Tab principale pagina ──────────────────────────────────────────────────
const TABS_PAGINA = [
  { value: 'utenti',       label: 'Utenti' },
  { value: 'segnalazioni', label: 'Messaggi' },
];

export default function Utenze() {
  const [utenti, setUtenti]           = useState([]);
  const [conteggi, setConteggi]       = useState({});
  const [loading, setLoading]         = useState(true);
  const [errore, setErrore]           = useState('');
  const [tabPagina, setTabPagina]     = useState('utenti');   // 'utenti' | 'segnalazioni'
  const [tabAttiva, setTabAttiva]     = useState('tutti');
  const [conferma, setConferma]       = useState(null);
  const [feedback, setFeedback]       = useState('');

  // Segnalazioni
  const [segnalazioni, setSegnalazioni]     = useState([]);
  const [loadingSeg, setLoadingSeg]         = useState(false);

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

  // ── Carica segnalazioni ───────────────────────────────────────────────
  const caricaSegnalazioni = useCallback(async () => {
    setLoadingSeg(true);
    try {
      const data = await getSegnalazioni();
      setSegnalazioni(data);
      console.log('[UTENZE] Segnalazioni caricate:', data.length);
    } catch (err) {
      console.error('[UTENZE] Errore segnalazioni:', err.message);
    } finally {
      setLoadingSeg(false);
    }
  }, []);

  useEffect(() => {
    if (tabPagina === 'segnalazioni') caricaSegnalazioni();
  }, [tabPagina, caricaSegnalazioni]);

  async function marcaLetta(id) {
    try {
      await segnaLetta(id);
      setSegnalazioni(prev => prev.map(s => s.id === id ? { ...s, stato: 'LETTO' } : s));
      console.log('[UTENZE] Segnalazione', id, 'marcata letta');
    } catch (err) {
      console.error('[UTENZE] Errore marca letta:', err.message);
    }
  }

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

  const segnalazioniNuove = segnalazioni.filter(s => s.stato === 'NUOVO').length;

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
    <div className="flex flex-col gap-8">

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

      {/* ── KPI cards — altezza minima 110px, padding 20px, numero rimpicciolito */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Totale utenti', valore: conteggi.totale ?? 0, colore: 'var(--info)' },
          { label: 'In attesa',     valore: conteggi.pending ?? 0, colore: 'var(--warning)', urgente: (conteggi.pending ?? 0) > 0 },
          { label: 'Attivi',        valore: conteggi.attivo ?? 0,  colore: 'var(--success)' },
          { label: 'Bloccati',      valore: conteggi.bloccato ?? 0, colore: 'var(--danger)' },
        ].map(k => (
          <div
            key={k.label}
            className="rounded-xl"
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${k.urgente ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
              padding: '20px 24px',
              minHeight: 114,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Etichetta leggibile e ben distanziata dal numero */}
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              {k.label}
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: k.colore }}>
              {k.valore}
            </p>
            {k.urgente && (
              <p style={{ fontSize: 11, marginTop: 8, fontWeight: 600, color: 'var(--warning)' }}>
                Richiede approvazione
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Tab principale pagina: Utenti | Messaggi ─────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-secondary)' }}>
        {TABS_PAGINA.map(tab => {
          const attiva = tabPagina === tab.value;
          const nuovi  = tab.value === 'segnalazioni' ? (conteggi.messaggi_nuovi ?? 0) : 0;
          return (
            <button
              key={tab.value}
              onClick={() => setTabPagina(tab.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: attiva ? 'var(--accent)' : 'transparent',
                color: attiva ? '#000' : 'var(--text-muted)',
              }}
            >
              {tab.label}
              {nuovi > 0 && (
                <span style={{ padding: '2px 6px', borderRadius: 20, fontSize: 11, fontWeight: 700, lineHeight: 1.2, background: '#ef4444', color: '#fff' }}>
                  {nuovi}
                </span>
              )}
            </button>
          );
        })}
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

      {/* ── Sezione Segnalazioni ────────────────────────────────────────── */}
      {tabPagina === 'segnalazioni' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Messaggi degli Utenti</h2>
            {segnalazioniNuove > 0 && (
              <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#ef4444', color: '#fff' }}>
                {segnalazioniNuove} nuovi
              </span>
            )}
          </div>

          {loadingSeg ? (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>Caricamento messaggi…</div>
          ) : segnalazioni.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nessuna segnalazione ricevuta</p>
            </div>
          ) : (
            <div>
              {segnalazioni.map(seg => {
                const nuova = seg.stato === 'NUOVO';
                const data  = new Date(seg.data_invio).toLocaleDateString('it-IT', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                });
                return (
                  <div
                    key={seg.id}
                    style={{
                      padding: '20px 24px',
                      display: 'flex',
                      flexDirection: 'row',
                      gap: 16,
                      background: nuova ? 'rgba(239,68,68,0.04)' : 'transparent',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        {nuova && (
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            NUOVO
                          </span>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {seg.oggetto || 'Segnalazione'}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                        Da: <strong style={{ color: 'var(--text-secondary)' }}>
                          {[seg.nome, seg.cognome].filter(Boolean).join(' ') || seg.username || seg.email}
                        </strong>
                        {seg.email && ` · ${seg.email}`}
                        {' · '}{data}
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {seg.messaggio}
                      </p>
                      <p style={{ fontSize: 11, marginTop: 10, color: 'var(--text-muted)' }}>
                        Risposta: via email all'indirizzo dell'utente registrato
                      </p>
                    </div>
                    {nuova && (
                      <div style={{ flexShrink: 0 }}>
                        <button
                          onClick={() => marcaLetta(seg.id)}
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                        >
                          Segna letto
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs filtro ───────────────────────────────────────────────── */}
      {tabPagina === 'utenti' && (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Tab bar */}
        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 16px', gap: 4, background: 'var(--bg-secondary)' }}>
          {TABS_UTENTI.map(tab => {
            const attiva = tabAttiva === tab.value;
            const count = tab.value === 'tutti' ? (conteggi.totale ?? 0)
              : (conteggi[tab.value] ?? 0);
            return (
              <button
                key={tab.value}
                onClick={() => setTabAttiva(tab.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '14px 20px',
                  fontSize: 13, fontWeight: attiva ? 600 : 400,
                  color: attiva ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: attiva ? '2px solid var(--accent)' : '2px solid transparent',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  marginBottom: '-1px', transition: 'color 0.12s', flexShrink: 0,
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    style={{
                      padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700, lineHeight: 1.4,
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
              {/* Header tabella: maiuscolo, lettering marcato, sfondo differenziato */}
              <thead style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                <tr>
                  {['Utente', 'Email', 'Stato', 'Registrato il', 'Ultimo accesso', 'Azioni'].map(h => (
                    <th
                      key={h}
                      style={{ padding: '14px 24px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {utentiFiltrati.map((u, idx) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}
                  >
                    {/* Avatar + nome */}
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, background: 'var(--accent)', color: '#0f1117' }}
                        >
                          {(u.nome?.[0] ?? u.username?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {u.nome && u.cognome ? `${u.nome} ${u.cognome}` : u.username}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{u.email}</span>
                    </td>

                    {/* Stato */}
                    <td style={{ padding: '16px 24px' }}>
                      <BadgeStato stato={u.stato} />
                    </td>

                    {/* Date */}
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatData(u.created_at)}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatData(u.ultimo_accesso)}</span>
                    </td>

                    {/* Azioni */}
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {u.stato === 'pending' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'approva', email: u.email })}
                            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                          >
                            Approva
                          </button>
                        )}
                        {u.stato === 'attivo' && u.ruolo !== 'admin' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'blocca', email: u.email })}
                            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                          >
                            Blocca
                          </button>
                        )}
                        {u.stato === 'bloccato' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'riattiva', email: u.email })}
                            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}
                          >
                            Riattiva
                          </button>
                        )}
                        {u.ruolo !== 'admin' && (
                          <button
                            onClick={() => setConferma({ id: u.id, azione: 'elimina', email: u.email })}
                            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'rgba(239,68,68,0.07)', color: 'var(--text-muted)' }}
                          >
                            Elimina
                          </button>
                        )}
                        {u.ruolo === 'admin' && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— account admin</span>
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
      )}

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
