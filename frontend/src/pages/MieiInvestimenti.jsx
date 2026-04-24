import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getPortafoglio, getSummaryPortafoglio, rimuoviDaPortafoglio,
  getCensimenti, creaCensimento, aggiornaCensimento, eliminaCensimento,
  togglePreferitoImmobile, cambiaStatoImmobile,
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

// Converte input prezzo in formato italiano (400.000 → 400000)
function parsePrezzo(val) {
  if (!val && val !== 0) return '';
  return String(val).replace(/\./g, '').replace(',', '.');
}

// ── TAB SELECTOR ────────────────────────────────────────────────────────────
function TabSelector({ attiva, onCambio }) {
  const tabs = [
    { id: 'censimenti', label: 'Immobili Censiti', icon: '🏠' },
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
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            whiteSpace: 'nowrap', transition: 'all 0.15s',
            background: attiva === t.id ? 'var(--accent)' : 'transparent',
            color: attiva === t.id ? '#000' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer',
          }}
        >
          <span>{t.icon}</span><span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── MODAL GENERICO ────────────────────────────────────────────────────────────
function Modal({ titolo, onChiudi, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onChiudi} />
      <div
        className="relative z-10 w-full max-w-xl rounded-2xl overflow-hidden flex flex-col overflow-y-auto max-h-[92vh]"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div style={{ padding: '20px 36px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{titolo}</h2>
          <button onClick={onChiudi} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl text-sm";
const inputStyle = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', padding: '12px 16px', outline: 'none',
};
const labelCls = "block text-sm font-semibold mb-2";
const labelStyle = { color: 'var(--text-muted)', letterSpacing: '0.01em' };

// ── POPUP SPOSTA — icona freccia con checklist per cambiare stato ────────────
function SpostaPopup({ imm, onCambia }) {
  const [aperto, setAperto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aperto) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setAperto(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aperto]);

  const opzioni = {
    COMPRATO:      [{ id: 'INTERESSATO', label: '◎ Sposta in Interessati', color: '#fbbf24' }, { id: 'VENDUTO_TERZI', label: '→ Sposta in Venduto a Terzi', color: '#f87171' }],
    INTERESSATO:   [{ id: 'COMPRATO',    label: '✓ Sposta in Acquistati',  color: '#34d399' }, { id: 'VENDUTO_TERZI', label: '→ Sposta in Venduto a Terzi', color: '#f87171' }],
    VENDUTO_TERZI: [{ id: 'INTERESSATO', label: '◎ Sposta in Interessati', color: '#fbbf24' }, { id: 'COMPRATO',      label: '✓ Sposta in Acquistati',  color: '#34d399' }],
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setAperto(v => !v); }}
        title="Sposta in un'altra categoria"
        style={{ width: 32, height: 32, borderRadius: 8, background: aperto ? 'rgba(245,158,11,0.15)' : 'var(--bg-secondary)', border: aperto ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: aperto ? 'var(--accent)' : 'var(--text-muted)' }}
      >
        ⇄
      </button>
      {aperto && (
        <div
          style={{ position: 'absolute', right: 0, top: 36, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 220 }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sposta in</p>
          {(opzioni[imm.stato_interesse] || []).map(opt => (
            <button
              key={opt.id}
              onClick={e => { e.stopPropagation(); setAperto(false); onCambia(imm.id, imm.indirizzo, opt.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: opt.color, fontWeight: 600, textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MODAL DETTAGLIO IMMOBILE ─────────────────────────────────────────────────
function DettaglioImmobile({ imm, onChiudi, onModifica }) {
  const statoColore = { COMPRATO: '#34d399', INTERESSATO: '#fbbf24', VENDUTO_TERZI: '#f87171' };
  const col = statoColore[imm.stato_interesse] || 'var(--text-muted)';
  const righe = [
    ['Indirizzo',    imm.indirizzo],
    ['Quartiere',    imm.quartiere],
    ['Tipologia',    imm.tipologia],
    ['Superficie',   imm.superficie_mq ? `${imm.superficie_mq} mq` : null],
    ['Prezzo',       imm.prezzo_richiesto ? formatEuro(imm.prezzo_richiesto) : null],
    ['Acquisizione', imm.tipo_acquisizione],
    ['Stato Imm.',   imm.stato_immobile],
    ['Venditore',    imm.venditore],
    ['Data Asta',    imm.data_inizio_asta ? formatData(imm.data_inizio_asta) : null],
    ['Link',         imm.link_riferimento],
    ['Note',         imm.note],
    ['Inserito il',  formatData(imm.data_inserimento)],
  ].filter(([, v]) => v);

  return (
    <Modal titolo="Dettaglio Immobile" onChiudi={onChiudi}>
      {/* Badge stato */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: col }}>
          {imm.stato_interesse === 'COMPRATO' ? 'Acquistato' : imm.stato_interesse === 'INTERESSATO' ? 'Interessante' : 'Venduto a Terzi'}
        </span>
        {imm.preferito === 1 && <span style={{ fontSize: 14 }}>❤️</span>}
      </div>

      {/* Griglia info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {righe.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', gap: 16, padding: '10px 16px', background: i % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-card)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 100, flexShrink: 0 }}>{k}</span>
            {k === 'Link' ? (
              <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{v}</a>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{v}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />
      <div className="flex justify-center gap-3">
        <button onClick={onChiudi} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
          Chiudi
        </button>
        <button onClick={onModifica} style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          ✏ Modifica
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — IMMOBILI CENSITI
// ═══════════════════════════════════════════════════════════════════════════
function CensimentiTab() {
  const [immobili, setImmobili]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [subTab, setSubTab]       = useState('COMPRATO');
  const [modale, setModale]       = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [ricerca, setRicerca]     = useState('');
  const [filtriAperto, setFiltriAperto] = useState(false);
  const [filtri, setFiltri]       = useState({ tipo_acquisizione: '', tipologia: '', prezzo_da: '', prezzo_a: '' });
  const [conferma, setConferma]   = useState(null);
  const [dettaglioItem, setDettaglioItem] = useState(null);
  const [form, setForm] = useState({
    indirizzo: '', quartiere: '', tipologia: '',
    superficie_mq: '', prezzo_richiesto: '', stato_interesse: 'INTERESSATO',
    stato_immobile: 'NORMALE', venditore: '', note: '',
    tipo_acquisizione: '', link_riferimento: '', data_inizio_asta: '',
  });

  const carica = () => {
    setLoading(true);
    getCensimenti()
      .then(data => { setImmobili(data); console.log(`[CENSIMENTI] ${data.length} immobili caricati`); })
      .catch(err => console.error('[CENSIMENTI] Errore caricamento:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  function apriModale(item = null) {
    if (item) {
      setEditItem(item);
      setForm({
        indirizzo:         item.indirizzo         || '',
        quartiere:         item.quartiere         || '',
        tipologia:         item.tipologia         || '',
        superficie_mq:     item.superficie_mq     || '',
        prezzo_richiesto:  item.prezzo_richiesto  ? String(item.prezzo_richiesto) : '',
        stato_interesse:   item.stato_interesse   || 'INTERESSATO',
        stato_immobile:    item.stato_immobile    || 'NORMALE',
        venditore:         item.venditore         || '',
        note:              item.note              || '',
        tipo_acquisizione: item.tipo_acquisizione || '',
        link_riferimento:  item.link_riferimento  || '',
        data_inizio_asta:  item.data_inizio_asta  ? item.data_inizio_asta.substring(0, 10) : '',
      });
    } else {
      setEditItem(null);
      setForm({
        indirizzo: '', quartiere: '', tipologia: '',
        superficie_mq: '', prezzo_richiesto: '', stato_interesse: 'INTERESSATO',
        stato_immobile: 'NORMALE', venditore: '', note: '',
        tipo_acquisizione: '', link_riferimento: '', data_inizio_asta: '',
      });
    }
    setModale(true);
  }

  async function togglePreferito(id, valoreAttuale) {
    const nuovoValore = valoreAttuale ? 0 : 1;
    setImmobili(prev => prev.map(i => i.id === id ? { ...i, preferito: nuovoValore } : i));
    try {
      await togglePreferitoImmobile(id, nuovoValore);
    } catch (err) {
      console.error('[CENSIMENTI] Errore preferito:', err);
      setImmobili(prev => prev.map(i => i.id === id ? { ...i, preferito: valoreAttuale } : i));
    }
  }

  async function salva() {
    if (!form.indirizzo)        { alert('Inserisci la Via/Indirizzo'); return; }
    if (!form.tipologia)        { alert('Inserisci la Tipologia'); return; }
    if (!form.superficie_mq)    { alert('Inserisci i MQ'); return; }
    if (!form.prezzo_richiesto) { alert('Inserisci il Prezzo'); return; }
    if (!form.tipo_acquisizione){ alert('Seleziona la modalità di Acquisizione'); return; }
    if (form.tipo_acquisizione === 'ASTA' && !form.data_inizio_asta) {
      alert('Inserisci la Data Inizio Asta'); return;
    }
    try {
      // Pulisce il prezzo dal formato italiano (400.000 → 400000)
      const datiPuliti = {
        ...form,
        prezzo_richiesto: parsePrezzo(form.prezzo_richiesto) || form.prezzo_richiesto,
        superficie_mq:    parsePrezzo(form.superficie_mq)    || form.superficie_mq,
      };
      if (editItem) await aggiornaCensimento(editItem.id, datiPuliti);
      else await creaCensimento(datiPuliti);
      setModale(false);
      carica();
    } catch (err) {
      console.error('[CENSIMENTI] Errore salvataggio:', err);
    }
  }

  function chiediConferma(tipo, id, indirizzo, nuovoStato = null) {
    setConferma({ tipo, id, indirizzo, nuovoStato });
  }

  async function eseguiConferma() {
    if (!conferma) return;
    try {
      if (conferma.tipo === 'elimina') {
        await eliminaCensimento(conferma.id);
        setConferma(null);
        carica();
      } else {
        await cambiaStatoImmobile(conferma.id, conferma.nuovoStato);
        setImmobili(prev => prev.map(i =>
          i.id === conferma.id ? { ...i, stato_interesse: conferma.nuovoStato } : i
        ));
        setConferma(null);
      }
    } catch (err) {
      console.error('[CENSIMENTI] Errore operazione:', err);
      setConferma(null);
    }
  }

  const countPerStato = (stato) => immobili.filter(i => i.stato_interesse === stato).length;

  const immobiliSubTab = immobili.filter(i => i.stato_interesse === subTab);
  const immobiliFiltrati = immobiliSubTab.filter(imm => {
    const q = ricerca.toLowerCase();
    const matchVia      = !q || (imm.indirizzo || '').toLowerCase().includes(q);
    const matchTipo     = !filtri.tipo_acquisizione || imm.tipo_acquisizione === filtri.tipo_acquisizione;
    const matchTipologia= !filtri.tipologia || (imm.tipologia || '').toLowerCase().includes(filtri.tipologia.toLowerCase());
    const prezzo        = parseFloat(imm.prezzo_richiesto) || 0;
    const matchDa       = !filtri.prezzo_da || prezzo >= parseFloat(parsePrezzo(filtri.prezzo_da));
    const matchA        = !filtri.prezzo_a  || prezzo <= parseFloat(parsePrezzo(filtri.prezzo_a));
    return matchVia && matchTipo && matchTipologia && matchDa && matchA;
  });

  const filtriAttivi = filtri.tipo_acquisizione || filtri.tipologia || filtri.prezzo_da || filtri.prezzo_a;

  function statoStyle(stato) {
    if (stato === 'COMPRATO')      return { dot: '#34d399' };
    if (stato === 'VENDUTO_TERZI') return { dot: '#f87171' };
    return { dot: '#fbbf24' };
  }

  if (loading) return <LoadingSpinner text="Caricamento immobili..." />;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header: ricerca + filtri + NUOVO CENSIMENTO ─────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
            <input
              value={ricerca}
              onChange={e => setRicerca(e.target.value)}
              placeholder="Cerca per via..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <button
            onClick={() => setFiltriAperto(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: filtriAttivi ? 'rgba(245,158,11,0.15)' : 'var(--bg-secondary)', color: filtriAttivi ? 'var(--accent)' : 'var(--text-muted)', border: filtriAttivi ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ⊞ Filtri {filtriAttivi ? '·' : ''}
          </button>
          <button
            onClick={() => apriModale()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + NUOVO CENSIMENTO
          </button>
        </div>

        {/* Pannello filtri */}
        {filtriAperto && (
          <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {/* Acquisizione */}
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Acquisizione</p>
              <div className="flex flex-wrap gap-2">
                {[{ val: '', label: 'Tutte' }, { val: 'ASTA', label: 'ASTA' }, { val: 'AGENZIA', label: 'AGENZIA' }, { val: 'PRIVATO', label: 'PRIVATO' }].map(({ val, label }) => (
                  <button key={val} onClick={() => setFiltri(f => ({ ...f, tipo_acquisizione: val }))}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: filtri.tipo_acquisizione === val ? 'var(--accent)' : 'var(--bg-card)', color: filtri.tipo_acquisizione === val ? '#000' : 'var(--text-muted)', border: filtri.tipo_acquisizione === val ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Tipologia */}
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tipologia</p>
              <input
                value={filtri.tipologia}
                onChange={e => setFiltri(f => ({ ...f, tipologia: e.target.value }))}
                placeholder="Es. Appartamento"
                style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: '100%', maxWidth: 220 }}
              />
            </div>
            {/* Prezzo range */}
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prezzo (€)</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={filtri.prezzo_da}
                  onChange={e => setFiltri(f => ({ ...f, prezzo_da: e.target.value }))}
                  placeholder="Da es. 100.000"
                  style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: 140 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>–</span>
                <input
                  value={filtri.prezzo_a}
                  onChange={e => setFiltri(f => ({ ...f, prezzo_a: e.target.value }))}
                  placeholder="A es. 400.000"
                  style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: 140 }}
                />
              </div>
            </div>
            {filtriAttivi && (
              <button onClick={() => setFiltri({ tipo_acquisizione: '', tipologia: '', prezzo_da: '', prezzo_a: '' })}
                style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                × Rimuovi filtri
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sub-tabs: ACQUISTATI / INTERESSATI / VENDUTI A TERZI ──────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'COMPRATO',      label: 'Acquistati',     color: '#34d399' },
          { id: 'INTERESSATO',   label: 'Interessati',    color: '#fbbf24' },
          { id: 'VENDUTO_TERZI', label: 'Venduti a Terzi',color: '#f87171' },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{
              padding: '10px 18px', fontSize: 13,
              fontWeight: subTab === t.id ? 700 : 500,
              color: subTab === t.id ? t.color : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: subTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
            }}>
            {t.label}
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700, background: subTab === t.id ? t.color : 'var(--bg-secondary)', color: subTab === t.id ? '#000' : 'var(--text-muted)' }}>
              {countPerStato(t.id)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Lista immobili ─────────────────────────────────────────────── */}
      {immobili.length === 0 ? (
        <EmptyState icon="🏠" title="Nessun immobile censito" message="Registra immobili che hai acquistato o che ti interessano."
          action={<button onClick={() => apriModale()} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Aggiungi il primo immobile</button>}
        />
      ) : immobiliFiltrati.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 32, marginBottom: 10 }}>{immobiliSubTab.length === 0 ? '📋' : '🔍'}</p>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {immobiliSubTab.length === 0 ? 'Nessun immobile in questa categoria' : 'Nessun risultato'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {immobiliSubTab.length === 0 ? 'Aggiungi un censimento o cambia categoria' : 'Prova a modificare ricerca o filtri'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {immobiliFiltrati.map(imm => {
            const { dot } = statoStyle(imm.stato_interesse);
            return (
              <div
                key={imm.id}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => setDettaglioItem(imm)}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imm.indirizzo || '–'}
                    </p>
                    {imm.tipo_acquisizione && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-secondary)', color: 'var(--text-muted)', letterSpacing: '0.04em', flexShrink: 0 }}>
                        {imm.tipo_acquisizione}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                    {imm.tipologia && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{imm.tipologia}</span>}
                    {imm.superficie_mq && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{imm.superficie_mq} mq</span>}
                  </div>
                </div>

                {imm.prezzo_richiesto && (
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {formatEuro(imm.prezzo_richiesto)}
                  </p>
                )}

                {/* Icone azione — stopPropagation per non aprire il dettaglio */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {imm.stato_interesse === 'INTERESSATO' && (
                    <button
                      onClick={e => { e.stopPropagation(); togglePreferito(imm.id, imm.preferito); }}
                      title={imm.preferito ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                      style={{ width: 32, height: 32, borderRadius: 8, background: imm.preferito ? 'rgba(239,68,68,0.12)' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}
                    >
                      {imm.preferito ? '❤️' : '🤍'}
                    </button>
                  )}

                  {/* Icona freccia di spostamento */}
                  <SpostaPopup imm={imm} onCambia={(id, indirizzo, nuovoStato) => chiediConferma('stato', id, indirizzo, nuovoStato)} />

                  <button
                    onClick={e => { e.stopPropagation(); apriModale(imm); }}
                    title="Modifica"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                  >
                    ✏
                  </button>

                  <button
                    onClick={e => { e.stopPropagation(); chiediConferma('elimina', imm.id, imm.indirizzo); }}
                    title="Elimina"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dettaglio immobile ─────────────────────────────────────────── */}
      {dettaglioItem && (
        <DettaglioImmobile
          imm={dettaglioItem}
          onChiudi={() => setDettaglioItem(null)}
          onModifica={() => { setDettaglioItem(null); apriModale(dettaglioItem); }}
        />
      )}

      {/* ── Modal conferma ─────────────────────────────────────────────── */}
      {conferma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConferma(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl p-8 flex flex-col gap-5 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>
                {conferma.tipo === 'elimina' ? '🗑' : '⇄'}
              </span>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {conferma.tipo === 'elimina' ? 'Elimina immobile?' : 'Sposta immobile?'}
              </h3>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {conferma.tipo === 'elimina'
                  ? `Vuoi eliminare "${conferma.indirizzo}"?`
                  : `Sposta "${conferma.indirizzo}" in ${conferma.nuovoStato === 'COMPRATO' ? 'Acquistati' : conferma.nuovoStato === 'INTERESSATO' ? 'Interessati' : 'Venduto a Terzi'}?`}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConferma(null)}
                style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                Annulla
              </button>
              <button onClick={eseguiConferma}
                style={{ padding: '10px 20px', borderRadius: 10, background: conferma.tipo === 'elimina' ? 'rgba(239,68,68,0.9)' : 'var(--accent)', color: conferma.tipo === 'elimina' ? '#fff' : '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal form censimento ──────────────────────────────────────── */}
      {modale && (
        <Modal titolo={editItem ? 'Modifica Censimento' : 'Nuovo Censimento'} onChiudi={() => setModale(false)}>

          <div>
            <label className={labelCls} style={labelStyle}>Via / Indirizzo *</label>
            <input value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))}
              placeholder="Via Roma, 12" className={inputCls}
              style={{ ...inputStyle, borderColor: !form.indirizzo ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Dettagli Immobile</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Quartiere</label>
              <input value={form.quartiere} onChange={e => setForm(f => ({ ...f, quartiere: e.target.value }))}
                placeholder="Es. Villanova" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipologia *</label>
              <input value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))}
                placeholder="Es. Appartamento" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.tipologia ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Superficie (mq) *</label>
              <input
                type="text" inputMode="decimal"
                value={form.superficie_mq}
                onChange={e => setForm(f => ({ ...f, superficie_mq: e.target.value }))}
                placeholder="Es. 80" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.superficie_mq ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Prezzo Richiesto (€) *</label>
              <input
                type="text" inputMode="decimal"
                value={form.prezzo_richiesto}
                onChange={e => setForm(f => ({ ...f, prezzo_richiesto: e.target.value }))}
                placeholder="Es. 400.000" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.prezzo_richiesto ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Puoi scrivere 400.000 oppure 400000</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Stato & Acquisizione *</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Stato *</label>
              <select value={form.stato_interesse} onChange={e => setForm(f => ({ ...f, stato_interesse: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="COMPRATO">✓ Acquistato</option>
                <option value="INTERESSATO">◎ Interessato</option>
                <option value="VENDUTO_TERZI">→ Venduto a Terzi</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Acquisizione *</label>
              <select value={form.tipo_acquisizione} onChange={e => setForm(f => ({ ...f, tipo_acquisizione: e.target.value }))}
                className={inputCls}
                style={{ ...inputStyle, borderColor: !form.tipo_acquisizione ? 'rgba(245,158,11,0.7)' : 'var(--border)' }}>
                <option value="">-- Seleziona --</option>
                <option value="ASTA">ASTA</option>
                <option value="AGENZIA">AGENZIA</option>
                <option value="PRIVATO">PRIVATO</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Immobile</label>
              <select value={form.stato_immobile} onChange={e => setForm(f => ({ ...f, stato_immobile: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="NORMALE">Normale</option>
                <option value="OTTIMO">Ottimo</option>
                <option value="SCADENTE">Scadente / Da ristr.</option>
              </select>
            </div>
          </div>

          {form.tipo_acquisizione === 'ASTA' && (
            <div>
              <label className={labelCls} style={labelStyle}>Data Inizio Asta *</label>
              <input type="date" value={form.data_inizio_asta} onChange={e => setForm(f => ({ ...f, data_inizio_asta: e.target.value }))}
                className={inputCls}
                style={{ ...inputStyle, borderColor: !form.data_inizio_asta ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Link & Note</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>URL di Riferimento</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔗</span>
              <input type="url" value={form.link_riferimento} onChange={e => setForm(f => ({ ...f, link_riferimento: e.target.value }))}
                placeholder="https://..." className={inputCls}
                style={{ ...inputStyle, paddingLeft: 38 }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Venditore / Contatto</label>
              <input value={form.venditore} onChange={e => setForm(f => ({ ...f, venditore: e.target.value }))}
                placeholder="Nome agente o privato" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Note</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2} placeholder="Note sull'immobile..." className={inputCls}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />
          <div className="flex justify-center gap-3">
            <button onClick={() => setModale(false)}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={salva}
              style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
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

  function giorniRimanenti(dataFine) {
    if (!dataFine) return null;
    return Math.ceil((new Date(dataFine) - new Date()) / (1000 * 60 * 60 * 24));
  }

  if (loading) return <LoadingSpinner text="Caricamento locazioni..." />;

  const totaleCanoni = locazioni
    .filter(l => l.stato === 'ATTIVA')
    .reduce((s, l) => s + parseFloat(l.canone_mensile || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {locazioni.filter(l => l.stato === 'ATTIVA').length} locazioni attive
          {totaleCanoni > 0 && ` · ${formatEuro(totaleCanoni)}/mese`}
        </p>
        <button onClick={() => apriModale()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          <span>+</span> Nuova Locazione
        </button>
      </div>

      {locazioni.length === 0 ? (
        <EmptyState icon="🔑" title="Nessuna locazione registrata" message="Aggiungi i contratti di affitto attivi per tenerli monitorati."
          action={<button onClick={() => apriModale()} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Aggiungi prima locazione</button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {locazioni.map(loc => {
            const giorni = giorniRimanenti(loc.data_fine);
            const scadente = giorni !== null && giorni < 30;
            return (
              <div key={loc.id} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: `1px solid ${scadente ? 'rgba(239,68,68,0.4)' : 'var(--border)'}` }}>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{loc.indirizzo}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: loc.stato === 'ATTIVA' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: loc.stato === 'ATTIVA' ? 'var(--success)' : 'var(--danger)' }}>
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
                    {loc.email_inquilino && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{loc.email_inquilino}</p>}
                  </div>
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
                        {giorni !== null && giorni >= 0 && <span className="block text-xs" style={{ color: scadente ? 'var(--danger)' : 'var(--text-muted)' }}>({giorni}gg)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 items-end justify-end">
                    <button onClick={() => apriModale(loc)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      Modifica
                    </button>
                    <button onClick={() => elimina(loc.id, loc.indirizzo)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              <input value={form.quartiere} onChange={e => setForm(f => ({ ...f, quartiere: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipologia</label>
              <input value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))} placeholder="Es. Appartamento" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Superficie (mq)</label>
              <input type="number" value={form.superficie_mq} onChange={e => setForm(f => ({ ...f, superficie_mq: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Canone Mensile (€)</label>
              <input type="number" value={form.canone_mensile} onChange={e => setForm(f => ({ ...f, canone_mensile: e.target.value }))} placeholder="Es. 800" className={inputCls} style={inputStyle} />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold mb-2 mt-1" style={{ color: 'var(--accent)' }}>Dati Inquilino</p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Nome Inquilino</label>
              <input value={form.nome_inquilino} onChange={e => setForm(f => ({ ...f, nome_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Cognome Inquilino</label>
              <input value={form.cognome_inquilino} onChange={e => setForm(f => ({ ...f, cognome_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Email Inquilino</label>
              <input type="email" value={form.email_inquilino} onChange={e => setForm(f => ({ ...f, email_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Telefono Inquilino</label>
              <input type="tel" value={form.telefono_inquilino} onChange={e => setForm(f => ({ ...f, telefono_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Data Inizio Contratto</label>
              <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Data Fine Contratto</label>
              <input type="date" value={form.data_fine} onChange={e => setForm(f => ({ ...f, data_fine: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Contratto</label>
              <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="ATTIVA">Attiva</option>
                <option value="SCADUTA">Scaduta</option>
                <option value="TERMINATA">Terminata</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Note</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div className="flex justify-center gap-3 pt-2">
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
  const [duplicaItem, setDuplicaItem] = useState(null);
  const [duplicaStato, setDuplicaStato] = useState('INTERESSATO');
  const [duplicando, setDuplicando] = useState(false);

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

  async function eseguiDuplica() {
    if (!duplicaItem) return;
    setDuplicando(true);
    try {
      await creaCensimento({
        indirizzo:         duplicaItem.indirizzo || '',
        quartiere:         '',
        tipologia:         duplicaItem.tipologia || '',
        superficie_mq:     duplicaItem.superficie_mq || '',
        prezzo_richiesto:  duplicaItem.prezzo_acquisto || duplicaItem.vcm_valore_medio || '',
        stato_interesse:   duplicaStato,
        stato_immobile:    duplicaItem.stato_immobile || 'NORMALE',
        venditore:         '',
        note:              `Importato da Valutazioni Eseguite`,
        tipo_acquisizione: 'PRIVATO',
        link_riferimento:  '',
        data_inizio_asta:  '',
      });
      console.log('[VALUTAZIONI] Duplica in Censimenti OK');
      setDuplicaItem(null);
      alert('Immobile aggiunto a Immobili Censiti!');
    } catch (err) {
      console.error('[VALUTAZIONI] Errore duplica:', err);
      alert('Errore durante il salvataggio.');
    } finally {
      setDuplicando(false);
    }
  }

  if (loading) return <LoadingSpinner text="Caricamento valutazioni..." />;

  return (
    <div className="flex flex-col gap-4">
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
        <EmptyState icon="📊" title="Nessuna valutazione eseguita" message="Usa il Wizard Valutazione per analizzare un immobile e aggiungilo al portafoglio."
          action={<button onClick={() => navigate('/valutazione')} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Valuta il primo immobile</button>}
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
                  {/* Icona duplica → Immobili Censiti */}
                  <button
                    onClick={() => { setDuplicaItem(imm); setDuplicaStato('INTERESSATO'); }}
                    title="Aggiungi a Immobili Censiti"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    + Censisci
                  </button>
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

      {/* Modal duplica → censimento */}
      {duplicaItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDuplicaItem(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div>
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Aggiungi a Immobili Censiti</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {duplicaItem.indirizzo || 'Immobile'} · {duplicaItem.tipologia}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scegli categoria</p>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'COMPRATO',      label: '✓ Acquistati',     color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
                  { id: 'INTERESSATO',   label: '◎ Interessanti',   color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' },
                  { id: 'VENDUTO_TERZI', label: '→ Venduto a Terzi',color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
                ].map(opt => (
                  <label
                    key={opt.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', background: duplicaStato === opt.id ? opt.bg : 'var(--bg-secondary)', border: `1px solid ${duplicaStato === opt.id ? opt.color + '55' : 'var(--border)'}` }}
                  >
                    <input type="radio" name="stato_duplica" value={opt.id} checked={duplicaStato === opt.id} onChange={() => setDuplicaStato(opt.id)} style={{ accentColor: opt.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: duplicaStato === opt.id ? opt.color : 'var(--text-secondary)' }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDuplicaItem(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                Annulla
              </button>
              <button onClick={eseguiDuplica} disabled={duplicando}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: duplicando ? 0.5 : 1 }}>
                {duplicando ? '...' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function MieiInvestimenti() {
  const [searchParams] = useSearchParams();
  const tabIniziale = searchParams.get('tab') || 'censimenti';
  const [tabAttiva, setTabAttiva] = useState(tabIniziale);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>I Miei Investimenti</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gestisci il tuo portafoglio immobiliare</p>
      </div>

      <TabSelector attiva={tabAttiva} onCambio={setTabAttiva} />

      {tabAttiva === 'censimenti'  && <CensimentiTab />}
      {tabAttiva === 'locazioni'   && <LocazioniTab />}
      {tabAttiva === 'valutazioni' && <ValutazioniTab />}
    </div>
  );
}
