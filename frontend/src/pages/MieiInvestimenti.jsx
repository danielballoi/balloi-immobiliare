/**
 * MieiInvestimenti - Portafoglio immobiliare suddiviso in 3 tab:
 *
 *  1. CENSIMENTI IMMOBILI — immobili registrati manualmente (COMPRATO / INTERESSATO)
 *  2. LOCAZIONI ATTIVE    — contratti di affitto con dati inquilino + date
 *  3. VALUTAZIONI ESEGUITE — risultati salvati dal Wizard Valutazione
 */

import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import {
  getPortafoglio, getSummaryPortafoglio, rimuoviDaPortafoglio,
  getCensimenti, creaCensimento, aggiornaCensimento, eliminaCensimento,
  getLocazioni, creaLocazione, aggiornaLocazione, eliminaLocazione,
} from '../services/api';
import StatCard      from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState    from '../components/EmptyState';

const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';
const formatPct = (n) =>
  n != null ? `${Number(n).toFixed(1)}%` : '–';
const formatData = (iso) =>
  iso ? new Date(iso).toLocaleDateString('it-IT') : '–';

// ── TAB SELECTOR ────────────────────────────────────────────────────────────
function TabSelector({ attiva, onCambio }) {
  const tabs = [
    { id: 'censimenti', label: 'Censimenti Immobili', icon: '🏠' },
    { id: 'locazioni',  label: 'Locazioni Attive',    icon: '🔑' },
    { id: 'valutazioni',label: 'Valutazioni Eseguite',icon: '📊' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-secondary)', overflowX: 'auto' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onCambio(t.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            background: attiva === t.id ? 'var(--accent)' : 'transparent',
            color: attiva === t.id ? '#000' : 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── MODAL GENERICO ──────────────────────────────────────────────────────────
function Modal({ titolo, onChiudi, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onChiudi} />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl p-8 flex flex-col gap-6 overflow-y-auto max-h-[90vh]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{titolo}</h2>
          <button
            onClick={onChiudi}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── INPUT HELPER ─────────────────────────────────────────────────────────────
const inputCls = "w-full px-4 py-3 rounded-xl text-sm";
const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
const labelCls = "block text-sm font-medium mb-2";
const labelStyle = { color: 'var(--text-muted)' };

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — CENSIMENTI IMMOBILI
// ═══════════════════════════════════════════════════════════════════════════
function CensimentiTab() {
  const [immobili, setImmobili]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modale, setModale]       = useState(false);  // apri form nuovo censimento
  const [editItem, setEditItem]   = useState(null);   // item in modifica
  const [form, setForm]           = useState({
    titolo: '', indirizzo: '', quartiere: '', tipologia: '',
    superficie_mq: '', prezzo_richiesto: '', stato_interesse: 'INTERESSATO',
    stato_immobile: 'NORMALE', venditore: '', note: '',
  });

  const carica = () => {
    setLoading(true);
    getCensimenti()
      .then(data => { setImmobili(data); console.log(`[CENSIMENTI] ${data.length} immobili`); })
      .catch(err => console.error('[CENSIMENTI] Errore:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  function apriModale(item = null) {
    if (item) {
      setEditItem(item);
      setForm({
        titolo: item.titolo || '',
        indirizzo: item.indirizzo || '',
        quartiere: item.quartiere || '',
        tipologia: item.tipologia || '',
        superficie_mq: item.superficie_mq || '',
        prezzo_richiesto: item.prezzo_richiesto || '',
        stato_interesse: item.stato_interesse || 'INTERESSATO',
        stato_immobile: item.stato_immobile || 'NORMALE',
        venditore: item.venditore || '',
        note: item.note || '',
      });
    } else {
      setEditItem(null);
      setForm({ titolo: '', indirizzo: '', quartiere: '', tipologia: '', superficie_mq: '', prezzo_richiesto: '', stato_interesse: 'INTERESSATO', stato_immobile: 'NORMALE', venditore: '', note: '' });
    }
    setModale(true);
  }

  async function salva() {
    try {
      if (editItem) {
        await aggiornaCensimento(editItem.id, form);
      } else {
        await creaCensimento(form);
      }
      setModale(false);
      carica();
    } catch (err) {
      console.error('[CENSIMENTI] Errore salvataggio:', err);
    }
  }

  async function elimina(id, titolo) {
    if (!window.confirm(`Eliminare "${titolo || 'questo immobile'}" dai censimenti?`)) return;
    await eliminaCensimento(id);
    carica();
  }

  if (loading) return <LoadingSpinner text="Caricamento censimenti..." />;

  const comprati   = immobili.filter(i => i.stato_interesse === 'COMPRATO');
  const interessati = immobili.filter(i => i.stato_interesse === 'INTERESSATO');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {comprati.length} acquistati · {interessati.length} di interesse
        </p>
        <button
          onClick={() => apriModale()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          <span>+</span> Nuovo Censimento
        </button>
      </div>

      {immobili.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="Nessun immobile censito"
          message="Registra immobili che hai acquistato o che ti interessano per tenerli tracciati."
          action={
            <button
              onClick={() => apriModale()}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              Aggiungi il primo immobile
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {immobili.map(imm => {
            const comprato = imm.stato_interesse === 'COMPRATO';
            return (
              <div
                key={imm.id}
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${comprato ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.3)'}`,
                }}
              >
                {/* Header card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Icona casa */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ background: comprato ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}
                    >
                      🏠
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {imm.titolo || imm.indirizzo || 'Immobile'}
                      </p>
                      {imm.titolo && imm.indirizzo && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{imm.indirizzo}</p>
                      )}
                    </div>
                  </div>
                  {/* Badge stato */}
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: comprato ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color:      comprato ? 'var(--success)' : 'var(--accent)',
                    }}
                  >
                    {comprato ? '✓ COMPRATO' : '◎ INTERESSATO'}
                  </span>
                </div>

                {/* Dettagli */}
                <div className="text-xs flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>
                  {imm.quartiere && <span>📍 {imm.quartiere}</span>}
                  {imm.tipologia && <span>🏗 {imm.tipologia} {imm.superficie_mq ? `· ${imm.superficie_mq} mq` : ''}</span>}
                  {imm.prezzo_richiesto && (
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatEuro(imm.prezzo_richiesto)}
                    </span>
                  )}
                  {imm.venditore && <span>👤 {imm.venditore}</span>}
                  {imm.note && (
                    <p className="mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {imm.note}
                    </p>
                  )}
                </div>

                {/* Azioni */}
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => apriModale(imm)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => elimina(imm.id, imm.titolo)}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal form censimento */}
      {modale && (
        <Modal titolo={editItem ? 'Modifica Censimento' : 'Nuovo Censimento'} onChiudi={() => setModale(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Titolo / Riferimento</label>
              <input value={form.titolo} onChange={e => setForm(f => ({ ...f, titolo: e.target.value }))}
                placeholder="Es. Appartamento Via Roma" className={inputCls} style={inputStyle} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Indirizzo</label>
              <input value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))}
                placeholder="Via Roma, 12" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Quartiere</label>
              <input value={form.quartiere} onChange={e => setForm(f => ({ ...f, quartiere: e.target.value }))}
                placeholder="Es. Villanova" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipologia</label>
              <input value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))}
                placeholder="Es. Appartamento" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Superficie (mq)</label>
              <input type="number" value={form.superficie_mq} onChange={e => setForm(f => ({ ...f, superficie_mq: e.target.value }))}
                placeholder="Es. 80" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Prezzo Richiesto (€)</label>
              <input type="number" value={form.prezzo_richiesto} onChange={e => setForm(f => ({ ...f, prezzo_richiesto: e.target.value }))}
                placeholder="Es. 150000" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Interesse</label>
              <select value={form.stato_interesse} onChange={e => setForm(f => ({ ...f, stato_interesse: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="INTERESSATO">◎ Interessato</option>
                <option value="COMPRATO">✓ Comprato</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Immobile</label>
              <select value={form.stato_immobile} onChange={e => setForm(f => ({ ...f, stato_immobile: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="NORMALE">Normale</option>
                <option value="OTTIMO">Ottimo</option>
                <option value="SCADENTE">Scadente / Da ristrutturare</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Venditore / Contatto</label>
              <input value={form.venditore} onChange={e => setForm(f => ({ ...f, venditore: e.target.value }))}
                placeholder="Nome agente o privato" className={inputCls} style={inputStyle} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Note</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={3} placeholder="Note sull'immobile..."
                className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModale(false)} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={salva} style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {editItem ? 'Salva Modifiche' : 'Aggiungi'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — LOCAZIONI ATTIVE
// ═══════════════════════════════════════════════════════════════════════════
function LocazioniTab() {
  const [locazioni, setLocazioni]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modale, setModale]         = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState({
    indirizzo: '', quartiere: '', tipologia: '', superficie_mq: '', canone_mensile: '',
    nome_inquilino: '', cognome_inquilino: '', email_inquilino: '', telefono_inquilino: '',
    data_inizio: '', data_fine: '', stato: 'ATTIVA', note: '',
  });

  const carica = () => {
    setLoading(true);
    getLocazioni()
      .then(data => { setLocazioni(data); console.log(`[LOCAZIONI] ${data.length} locazioni`); })
      .catch(err => console.error('[LOCAZIONI] Errore:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  function apriModale(item = null) {
    if (item) {
      setEditItem(item);
      setForm({
        indirizzo:         item.indirizzo || '',
        quartiere:         item.quartiere || '',
        tipologia:         item.tipologia || '',
        superficie_mq:     item.superficie_mq || '',
        canone_mensile:    item.canone_mensile || '',
        nome_inquilino:    item.nome_inquilino || '',
        cognome_inquilino: item.cognome_inquilino || '',
        email_inquilino:   item.email_inquilino || '',
        telefono_inquilino:item.telefono_inquilino || '',
        data_inizio:       item.data_inizio ? item.data_inizio.substring(0, 10) : '',
        data_fine:         item.data_fine   ? item.data_fine.substring(0, 10)   : '',
        stato:             item.stato || 'ATTIVA',
        note:              item.note || '',
      });
    } else {
      setEditItem(null);
      setForm({ indirizzo: '', quartiere: '', tipologia: '', superficie_mq: '', canone_mensile: '', nome_inquilino: '', cognome_inquilino: '', email_inquilino: '', telefono_inquilino: '', data_inizio: '', data_fine: '', stato: 'ATTIVA', note: '' });
    }
    setModale(true);
  }

  async function salva() {
    try {
      if (editItem) await aggiornaLocazione(editItem.id, form);
      else await creaLocazione(form);
      setModale(false);
      carica();
    } catch (err) { console.error('[LOCAZIONI] Errore salvataggio:', err); }
  }

  async function elimina(id, indirizzo) {
    if (!window.confirm(`Eliminare la locazione di "${indirizzo}"?`)) return;
    await eliminaLocazione(id);
    carica();
  }

  // Calcola giorni rimanenti al termine contratto
  function giorniRimanenti(dataFine) {
    if (!dataFine) return null;
    const diff = new Date(dataFine) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  if (loading) return <LoadingSpinner text="Caricamento locazioni..." />;

  const totaleCanoni = locazioni
    .filter(l => l.stato === 'ATTIVA')
    .reduce((s, l) => s + parseFloat(l.canone_mensile || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {locazioni.filter(l => l.stato === 'ATTIVA').length} locazioni attive
            {totaleCanoni > 0 && ` · ${formatEuro(totaleCanoni)}/mese`}
          </p>
        </div>
        <button
          onClick={() => apriModale()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          <span>+</span> Nuova Locazione
        </button>
      </div>

      {locazioni.length === 0 ? (
        <EmptyState
          icon="🔑"
          title="Nessuna locazione registrata"
          message="Aggiungi i contratti di affitto attivi per tenerli monitorati."
          action={
            <button onClick={() => apriModale()} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Aggiungi prima locazione
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {locazioni.map(loc => {
            const giorni = giorniRimanenti(loc.data_fine);
            const scadente = giorni !== null && giorni < 30;
            return (
              <div
                key={loc.id}
                className="rounded-xl p-4"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${scadente ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                }}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Immobile */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {loc.indirizzo}
                      </h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background: loc.stato === 'ATTIVA' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color:      loc.stato === 'ATTIVA' ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {loc.stato}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {[loc.tipologia, loc.superficie_mq && `${loc.superficie_mq} mq`].filter(Boolean).join(' · ')}
                    </p>
                    {(loc.nome_inquilino || loc.cognome_inquilino) && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Inquilino: <strong style={{ color: 'var(--text-primary)' }}>{[loc.nome_inquilino, loc.cognome_inquilino].filter(Boolean).join(' ')}</strong>
                      </p>
                    )}
                    {loc.email_inquilino && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{loc.email_inquilino}</p>
                    )}
                  </div>

                  {/* KPI */}
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Canone</p>
                      <p className="font-bold" style={{ color: 'var(--accent)' }}>{formatEuro(loc.canone_mensile)}/m</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Inizio</p>
                      <p className="font-medium text-xs" style={{ color: 'var(--text-primary)' }}>{formatData(loc.data_inizio)}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Scadenza</p>
                      <p className="font-medium text-xs" style={{ color: scadente ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {loc.data_fine ? formatData(loc.data_fine) : '–'}
                        {giorni !== null && giorni >= 0 && (
                          <span className="block text-xs" style={{ color: scadente ? 'var(--danger)' : 'var(--text-muted)' }}>
                            ({giorni}gg)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Azioni */}
                  <div className="flex sm:flex-col gap-2 items-end justify-end">
                    <button
                      onClick={() => apriModale(loc)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => elimina(loc.id, loc.indirizzo)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal form locazione */}
      {modale && (
        <Modal titolo={editItem ? 'Modifica Locazione' : 'Nuova Locazione'} onChiudi={() => setModale(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Indirizzo Immobile*</label>
              <input required value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))}
                placeholder="Via Roma, 12" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Quartiere</label>
              <input value={form.quartiere} onChange={e => setForm(f => ({ ...f, quartiere: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipologia</label>
              <input value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))}
                placeholder="Es. Appartamento" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Superficie (mq)</label>
              <input type="number" value={form.superficie_mq} onChange={e => setForm(f => ({ ...f, superficie_mq: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Canone Mensile (€)</label>
              <input type="number" value={form.canone_mensile} onChange={e => setForm(f => ({ ...f, canone_mensile: e.target.value }))}
                placeholder="Es. 800" className={inputCls} style={inputStyle} />
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold mb-2 mt-1" style={{ color: 'var(--accent)' }}>Dati Inquilino</p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Nome Inquilino</label>
              <input value={form.nome_inquilino} onChange={e => setForm(f => ({ ...f, nome_inquilino: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Cognome Inquilino</label>
              <input value={form.cognome_inquilino} onChange={e => setForm(f => ({ ...f, cognome_inquilino: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Email Inquilino</label>
              <input type="email" value={form.email_inquilino} onChange={e => setForm(f => ({ ...f, email_inquilino: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Telefono Inquilino</label>
              <input type="tel" value={form.telefono_inquilino} onChange={e => setForm(f => ({ ...f, telefono_inquilino: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Data Inizio Contratto</label>
              <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Data Fine Contratto</label>
              <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Contratto</label>
              <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="ATTIVA">Attiva</option>
                <option value="SCADUTA">Scaduta</option>
                <option value="TERMINATA">Terminata</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Note</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2} className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModale(false)} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={salva} style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {editItem ? 'Salva Modifiche' : 'Aggiungi'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — VALUTAZIONI ESEGUITE (dal Wizard)
// ═══════════════════════════════════════════════════════════════════════════
function ValutazioniTab() {
  const navigate = useNavigate();
  const [immobili, setImmobili]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [rimuovendo, setRimuovendo] = useState(null);

  const carica = () => {
    setLoading(true);
    Promise.all([getPortafoglio(), getSummaryPortafoglio()])
      .then(([lista, sum]) => {
        console.log(`[VALUTAZIONI] ${lista.length} valutazioni`);
        setImmobili(lista);
        setSummary(sum);
      })
      .catch(err => console.error('[VALUTAZIONI] Errore:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  const rimuovi = async (id, indirizzo) => {
    if (!window.confirm(`Rimuovere "${indirizzo || 'questo immobile'}"?`)) return;
    setRimuovendo(id);
    try {
      await rimuoviDaPortafoglio(id);
      carica();
    } catch (err) {
      console.error('[VALUTAZIONI] Errore rimozione:', err);
    } finally {
      setRimuovendo(null);
    }
  };

  if (loading) return <LoadingSpinner text="Caricamento valutazioni..." />;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI aggregati */}
      {summary && summary.num_immobili > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Investimento Totale"  value={formatEuro(summary.investimento_totale)}    subtitle="Prezzi di acquisto" />
          <StatCard title="Valore Stimato"        value={formatEuro(summary.valore_stimato_totale)}  subtitle="Stima VCM"
            change={summary.plusvalenza_pct > 0 ? `+${summary.plusvalenza_pct}%` : `${summary.plusvalenza_pct}%`}
            positive={summary.plusvalenza_pct > 0}
          />
          <StatCard title="Canone Mensile"        value={formatEuro(summary.canone_mensile_totale)}  subtitle="Lordo totale" />
          <StatCard title="TIR Medio"             value={formatPct(summary.tir_medio)}               subtitle="Portafoglio" positive={summary.tir_medio > 6} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {immobili.length} valutazioni nel portafoglio
        </p>
        <button
          onClick={() => navigate('/valutazione')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          + Nuova Valutazione
        </button>
      </div>

      {immobili.length === 0 ? (
        <EmptyState
          icon="📊"
          title="Nessuna valutazione eseguita"
          message="Usa il Wizard Valutazione per analizzare un immobile e aggiungilo al portafoglio."
          action={
            <button onClick={() => navigate('/valutazione')} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Valuta il primo immobile
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {immobili.map(imm => (
            <div key={imm.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {imm.indirizzo || 'Indirizzo non specificato'}
                    </h3>
                    {imm.zona_codice && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' }}>
                        {imm.zona_codice}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {[imm.tipologia, imm.superficie_mq && `${imm.superficie_mq} mq`, imm.stato_immobile].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Inserito il {formatData(imm.data_inserimento)}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Acquisto</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{formatEuro(imm.prezzo_acquisto)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Valore Stimato</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>{formatEuro(imm.vcm_valore_medio)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Canone/mese</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{formatEuro(imm.canone_mensile)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>TIR</p>
                    <p className="font-semibold text-sm" style={{ color: imm.tir_pct > 6 ? 'var(--success)' : imm.tir_pct ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {formatPct(imm.tir_pct)}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 justify-end items-end">
                  <button
                    onClick={() => rimuovi(imm.id, imm.indirizzo)}
                    disabled={rimuovendo === imm.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    {rimuovendo === imm.id ? '...' : 'Rimuovi'}
                  </button>
                  {imm.van != null && (
                    <span className="px-2 py-1 rounded text-xs font-medium"
                      style={{ background: imm.van > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: imm.van > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      VAN {formatEuro(imm.van)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function MieiInvestimenti() {
  const [tabAttiva, setTabAttiva] = useState('censimenti');

  return (
    <div className="flex flex-col gap-4">
      {/* Intestazione */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>I Miei Investimenti</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Gestisci il tuo portafoglio immobiliare
        </p>
      </div>

      {/* Tab selector */}
      <TabSelector attiva={tabAttiva} onCambio={setTabAttiva} />

      {/* Contenuto tab attiva */}
      {tabAttiva === 'censimenti'  && <CensimentiTab />}
      {tabAttiva === 'locazioni'   && <LocazioniTab />}
      {tabAttiva === 'valutazioni' && <ValutazioniTab />}
    </div>
  );
}
