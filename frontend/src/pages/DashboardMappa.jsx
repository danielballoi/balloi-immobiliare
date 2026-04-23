/**
 * DashboardMappa - Pagina principale mercato immobiliare
 *
 * Layout normale:
 *   1. Hero image con barra di ricerca centrata
 *   2. Tab Cagliari Comune / Hinterland  +  bottone Nuova Valutazione (stessa riga)
 *   3. KPI cards aggregate
 *   4. Lista quartieri (colonne: # | Nome | Prezzo | Fascia)
 *      → Hinterland: + button per mostrare il quartiere OMI di ogni comune
 *   5. Right panel: banner brand (nessuna zona selezionata)
 *
 * Layout dettaglio (zonaSelezionata !== null):
 *   Back button + card dettaglio centrata full-width
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useHeatmap from '../hooks/useHeatmap';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import StradeAutocomplete from '../components/StradeAutocomplete';
import { getTipologie } from '../services/api';

const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';

const cleanNome = (s) => s?.replace(/^'+|'+$/g, '').trim() ?? '';

/* ── BarraPrezzo ─────────────────────────────────────────────────────── */
function BarraPrezzo({ valore, max, min }) {
  const pct = max > min ? ((valore - min) / (max - min)) * 100 : 50;
  const hue = Math.round(120 - (pct / 100) * 120);
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: `hsl(${hue}, 65%, 50%)`, transition: 'width 0.3s ease' }}
        />
      </div>
      <span className="text-xs font-mono w-24 text-right shrink-0" style={{ color: 'var(--text-primary)' }}>
        {formatEuro(valore)}/mq
      </span>
    </div>
  );
}

/* ── BadgeFascia ─────────────────────────────────────────────────────── */
function BadgeFascia({ fascia }) {
  const cfg = {
    A: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    B: { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
    C: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    D: { bg: 'rgba(16,185,129,0.15)',  color: '#10b981' },
    E: { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7' },
  };
  const c = cfg[fascia] ?? cfg.C;
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold shrink-0" style={{ background: c.bg, color: c.color }}>
      {fascia ?? '–'}
    </span>
  );
}

/* ── InfoFascia — popup con spiegazione lettere OMI ─────────────────── */
function InfoFascia() {
  const [aperto, setAperto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aperto) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setAperto(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aperto]);

  const fasce = [
    { lettera: 'A', colore: '#f59e0b', nome: 'Pregio / Centro storico',   desc: 'Zone di massimo pregio, alta domanda e prezzi elevati.' },
    { lettera: 'B', colore: '#3b82f6', nome: 'Semicentrale / Normale',    desc: 'Zone semicentrali con buon mix di servizi, prezzi nella media.' },
    { lettera: 'C', colore: '#94a3b8', nome: 'Periferica',                 desc: 'Zone periferiche, buona accessibilità ma lontane dal centro.' },
    { lettera: 'D', colore: '#10b981', nome: 'Extraurbana / Suburbana',    desc: 'Zone fuori dal centro urbano, spesso residenziali o industriali.' },
    { lettera: 'E', colore: '#a855f7', nome: 'Agricola / Rurale',          desc: 'Zone a prevalente destinazione agricola o con carattere rurale.' },
  ];

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setAperto(v => !v); }}
        style={{
          marginLeft: 4,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(100,116,139,0.3)',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        title="Significato fasce OMI"
      >
        i
      </button>

      {aperto && (
        <div
          className="absolute z-50 top-full mt-2 right-0 rounded-xl p-4 shadow-xl w-72"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Fasce OMI — Significato
          </p>
          <div className="flex flex-col gap-2.5">
            {fasce.map(f => (
              <div key={f.lettera} className="flex items-start gap-2">
                <span
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
                  style={{ background: f.colore + '25', color: f.colore }}
                >
                  {f.lettera}
                </span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.nome}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ComuneAutocomplete ──────────────────────────────────────────────── */
function ComuneAutocomplete({ comuni, onSeleziona, onSvuota, placeholder }) {
  const [query, setQuery]             = useState('');
  const [aperto, setAperto]           = useState(false);
  const [indiceFocus, setIndiceFocus] = useState(-1);
  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);

  const suggerimenti = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return comuni.filter(c => c.toLowerCase().includes(q));
  }, [query, comuni]);

  useEffect(() => {
    function handler(e) {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setAperto(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function seleziona(comune) {
    setQuery(comune); setAperto(false); setIndiceFocus(-1); onSeleziona(comune);
  }
  function svuota() {
    setQuery(''); setAperto(false); setIndiceFocus(-1); onSvuota?.(); inputRef.current?.focus();
  }
  function handleKeyDown(e) {
    if (!aperto || suggerimenti.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setIndiceFocus(i => Math.min(i + 1, suggerimenti.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setIndiceFocus(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && indiceFocus >= 0) { e.preventDefault(); seleziona(suggerimenti[indiceFocus]); }
    else if (e.key === 'Escape') setAperto(false);
  }

  return (
    <div className="relative">
      <div
        className="flex items-center rounded-xl"
        style={{ background: 'rgba(15,17,23,0.70)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)' }}
      >
        <svg className="ml-4 w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setAperto(true); setIndiceFocus(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggerimenti.length > 0 && setAperto(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ flex: 1, padding: '14px 16px', fontSize: 15, background: 'transparent', color: '#fff', outline: 'none' }}
        />
        {query && (
          <button onClick={svuota}
            style={{ marginRight: 12, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.20)', color: '#fff', fontSize: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ×
          </button>
        )}
      </div>
      {aperto && suggerimenti.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {suggerimenti.map((comune, idx) => (
            <button
              key={comune}
              onMouseDown={e => { e.preventDefault(); seleziona(comune); }}
              onMouseEnter={() => setIndiceFocus(idx)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px 10px 16px', textAlign: 'left', fontSize: 14, cursor: 'pointer',
                background: idx === indiceFocus ? 'var(--bg-hover)' : 'transparent',
                borderBottom: idx < suggerimenti.length - 1 ? '1px solid var(--border)' : 'none',
                color: 'var(--text-primary)', border: 'none',
              }}
            >
              <span style={{ fontWeight: 500 }}>{comune}</span>
              <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 4, fontSize: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981', flexShrink: 0 }}>
                Hinterland
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── QuartierePickerModal — scelta quartiere OMI per un comune ──────── */
function QuartierePickerModal({ zones, nomeComune, onSeleziona, onChiudi }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onChiudi} />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
              Seleziona il quartiere OMI
            </p>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {nomeComune}
            </h3>
          </div>
          <button
            onClick={onChiudi}
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 18, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Lista quartieri */}
        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {zones.map((z, idx) => (
            <button
              key={z.link_zona}
              onClick={() => onSeleziona(z)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: idx < zones.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                  {cleanNome(z.descrizione_zona)}
                </p>
                {z.prezzo_medio && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatEuro(z.prezzo_medio)}/mq
                    {z.locazione_media ? ` · ${formatEuro(z.locazione_media)}/mq/mese` : ''}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                <BadgeFascia fascia={z.fascia} />
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M5 2l5 5-5 5" />
                </svg>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

/* ── SelettoreArea — tab Cagliari Comune / Hinterland ───────────────── */
function SelettoreArea({ area, onCambio }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-secondary)' }}>
      {[
        { value: 'CAGLIARI',   label: 'Cagliari Comune' },
        { value: 'HINTERLAND', label: 'Cagliari Hinterland' },
      ].map(tab => {
        const attivo = area === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onCambio(tab.value)}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.15s',
              background: attivo ? 'var(--accent)' : 'transparent',
              color: attivo ? '#000' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function DashboardMappa() {
  const navigate = useNavigate();

  const [area, setArea]                   = useState('CAGLIARI');
  const [zonaFocused, setZonaFocused]     = useState(null);
  const [comuneFocused, setComuneFocused] = useState('');
  const [zonaSelezionata, setZonaSelezionata] = useState(null);
  const [viaRicercata, setViaRicercata]   = useState('');
  const [expandedRows, setExpandedRows]   = useState(new Set());
  const [mostraLocazione, setMostraLocazione] = useState(false);
  const [tipologie, setTipologie]         = useState([]);
  const [comunePicker, setComunePicker]   = useState(null);
  const [filtri, setFiltri]               = useState({
    fasce:    [],
    prezzoMin: '',
    prezzoMax: '',
    roiOp:   '>',
    roiVal:  '',
    varOp:   '',
    tipologia: '',
  });

  useEffect(() => {
    getTipologie().then(setTipologie).catch(() => {});
  }, []);

  const { zone, loading, errore } = useHeatmap(null, area);

  const prezzi      = zone.map(z => parseFloat(z.prezzo_medio)).filter(Boolean);
  const prezzoMin   = prezzi.length ? Math.min(...prezzi) : 0;
  const prezzoMax   = prezzi.length ? Math.max(...prezzi) : 1;
  const prezzoMedio = prezzi.length ? prezzi.reduce((a, b) => a + b, 0) / prezzi.length : 0;

  const locazioni     = zone.map(z => parseFloat(z.locazione_media)).filter(Boolean);
  const locazioneMin  = locazioni.length ? Math.min(...locazioni) : 0;
  const locazioneMax  = locazioni.length ? Math.max(...locazioni) : 1;

  const valMin  = mostraLocazione ? locazioneMin  : prezzoMin;
  const valMax  = mostraLocazione ? locazioneMax  : prezzoMax;

  const isHinterland = area === 'HINTERLAND';
  const gridColonne  = '2.5rem 1fr 1fr auto';

  function toggleExpand(id) {
    setExpandedRows(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function handleStradeSeleziona(item) {
    let zona = null;
    if (item.link_zona) zona = zone.find(z => z.link_zona === item.link_zona);
    if (!zona && item.quartiere) {
      const q = item.quartiere.toUpperCase();
      zona = zone.find(z => cleanNome(z.descrizione_zona).toUpperCase().includes(q));
    }
    if (zona) {
      setViaRicercata(item.via || '');
      setZonaFocused(zona);
      setZonaSelezionata(zona);
    }
  }

  function handleComuneSelezionato(nomeComune) {
    setComuneFocused(nomeComune);
    setViaRicercata('');
    const zonesComune = zone.filter(z => z.comune === nomeComune);
    if (zonesComune.length === 1) {
      setZonaSelezionata(zonesComune[0]);
    } else if (zonesComune.length > 1) {
      setComunePicker(nomeComune);
    }
  }

  function tornaAllaLista() {
    setZonaSelezionata(null);
    setZonaFocused(null);
    setComuneFocused('');
    setViaRicercata('');
    setComunePicker(null);
  }

  const zoneFiltrate = useMemo(() => {
    let arr = area === 'CAGLIARI'
      ? (zonaFocused ? [zonaFocused] : zone)
      : (comuneFocused ? zone.filter(z => z.comune === comuneFocused) : zone);

    if (filtri.fasce.length > 0)
      arr = arr.filter(z => filtri.fasce.includes(z.fascia));
    if (filtri.prezzoMin)
      arr = arr.filter(z => parseFloat(mostraLocazione ? z.locazione_media : z.prezzo_medio) >= parseFloat(filtri.prezzoMin));
    if (filtri.prezzoMax)
      arr = arr.filter(z => parseFloat(mostraLocazione ? z.locazione_media : z.prezzo_medio) <= parseFloat(filtri.prezzoMax));
    if (filtri.roiVal) {
      arr = arr.filter(z => {
        if (!z.locazione_media || !z.prezzo_medio) return false;
        const roi = (parseFloat(z.locazione_media) * 12) / parseFloat(z.prezzo_medio) * 100;
        return filtri.roiOp === '>' ? roi > parseFloat(filtri.roiVal) : roi < parseFloat(filtri.roiVal);
      });
    }
    if (filtri.varOp === 'sopra')
      arr = arr.filter(z => parseFloat(z.prezzo_medio) > prezzoMedio);
    else if (filtri.varOp === 'sotto')
      arr = arr.filter(z => parseFloat(z.prezzo_medio) < prezzoMedio);

    return arr;
  }, [zone, area, zonaFocused, comuneFocused, filtri, prezzoMedio, mostraLocazione]);

  if (loading) return <LoadingSpinner text="Caricamento dati OMI..." />;

  if (errore) return (
    <div className="flex items-center justify-center h-64 text-center px-4">
      <div>
        <p className="mb-4 text-sm" style={{ color: 'var(--danger)' }}>⚠ {errore}</p>
        <button onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Riprova
        </button>
      </div>
    </div>
  );

  /* ── Card dettaglio zona (riusata in entrambi i layout) ──────────── */
  function DettaglioContenuto() {
    if (!zonaSelezionata) return null;
    return (
      <>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {viaRicercata && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                  📍 <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{viaRicercata}</span> si trova in:
                </p>
              </div>
            )}
            {isHinterland ? (
              <>
                <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)', marginBottom: 2 }}>
                  {zonaSelezionata.comune ?? '–'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cleanNome(zonaSelezionata.descrizione_zona)}</p>
              </>
            ) : (
              <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
                {cleanNome(zonaSelezionata.descrizione_zona)}
              </h3>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <BadgeFascia fascia={zonaSelezionata.fascia} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fascia {zonaSelezionata.fascia ?? '–'}</span>
            </div>
          </div>
          <button onClick={tornaAllaLista}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>
            ×
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Statistiche Quartiere
        </p>

        <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
            Compravendita
          </p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {formatEuro(zonaSelezionata.prezzo_medio)}
            <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 6, color: 'var(--text-muted)' }}>/mq</span>
          </p>
        </div>

        {zonaSelezionata.locazione_media && (
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
              Locazione
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {formatEuro(zonaSelezionata.locazione_media)}
              <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 6, color: 'var(--text-muted)' }}>/mq/mese</span>
            </p>
          </div>
        )}

        {zonaSelezionata.prezzo_medio && prezzoMedio > 0 && (() => {
          const diff = ((parseFloat(zonaSelezionata.prezzo_medio) - prezzoMedio) / prezzoMedio) * 100;
          const sopra = diff > 0;
          return (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
                Vs. Media Mercato
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: sopra ? 'var(--danger)' : 'var(--success)' }}>
                {sopra ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, color: 'var(--text-muted)' }}>
                  {sopra ? 'sopra' : 'sotto'} la media
                </span>
              </p>
            </div>
          );
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
          <button
            onClick={() => navigate(`/statistiche?nome=${encodeURIComponent(zonaSelezionata.descrizione_zona)}`)}
            style={{ width: '100%', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            Analisi storica 2020–2025 →
          </button>
          <button
            onClick={() => navigate(`/valutazione?zona=${zonaSelezionata.link_zona}`)}
            style={{ width: '100%', padding: '11px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#000', border: 'none' }}
          >
            Valuta Immobile →
          </button>
        </div>
      </>
    );
  }

  /* ── LAYOUT DETTAGLIO: zona selezionata ─────────────────────────── */
  if (zonaSelezionata) {
    return (
      <div className="flex flex-col gap-5">
        <button
          onClick={tornaAllaLista}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 10,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2L4 7l5 5" />
          </svg>
          Torna alla lista
        </button>

        {/* Card centrata */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '100%', maxWidth: 600,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <DettaglioContenuto />
          </div>
        </div>
      </div>
    );
  }

  /* ── LAYOUT NORMALE ─────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5">

      {/* ── Picker quartieri hinterland ───────────────────────────── */}
      {comunePicker && (
        <QuartierePickerModal
          zones={zone.filter(z => z.comune === comunePicker)}
          nomeComune={comunePicker}
          onSeleziona={(z) => { setZonaSelezionata(z); setComunePicker(null); }}
          onChiudi={() => setComunePicker(null)}
        />
      )}

      {/* ── Hero image ─────────────────────────────────────────────── */}
      {/* paddingBottom: '40%' → hero più alto, dà respiro verticale per spostare il contenuto in alto */}
      <div className="relative rounded-2xl overflow-hidden" style={{ paddingBottom: '40%', minHeight: 260 }}>

        <img
          src="/cagliari-hero.jpg"
          alt="Cagliari skyline"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 38%',
          }}
        />

        {/* Gradiente a 4 step: cielo quasi trasparente → mare/orizzonte → rocce scure in basso */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(10,12,15,0.05) 0%, rgba(10,12,15,0.18) 30%, rgba(10,12,15,0.55) 65%, rgba(10,12,15,0.90) 100%)' }} />

        {/* Titolo nella zona del cielo/orizzonte (top ~18%) — sopra rocce e zona scura */}
        <div
          style={{
            position: 'absolute',
            top: '18%',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            padding: '0 24px',
          }}
        >
          {/* Titolo — allineato al centro dell'orizzonte (sopra città e lagune) */}
          <div className="text-center">
            <h1 style={{ fontSize: 27, fontWeight: 800, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.6)', marginBottom: 6, letterSpacing: '-0.02em' }}>
              Mercato Immobiliare
              {isHinterland ? ' — Cagliari Hinterland' : ' — Cagliari Comune'}
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
              Dati OMI aggiornati · {zone.length} {isHinterland ? 'comuni' : 'quartieri'} monitorati
            </p>
          </div>

          {/* Barra di ricerca — posizionata nella zona celeste/mare (sfondo pulito e omogeneo) */}
          <div style={{ width: '100%', maxWidth: 560 }}>
            {area === 'CAGLIARI' ? (
              <StradeAutocomplete
                onSeleziona={handleStradeSeleziona}
                onSvuota={() => { setZonaFocused(null); setZonaSelezionata(null); }}
                placeholder="Cerca via, viale, piazza a Cagliari…"
              />
            ) : (
              <ComuneAutocomplete
                comuni={[...new Set(zone.map(z => z.comune).filter(Boolean))].sort()}
                onSeleziona={handleComuneSelezionato}
                onSvuota={() => { setComuneFocused(''); setZonaSelezionata(null); }}
                placeholder="Cerca comune nell'Hinterland…"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Tab + Nuova Valutazione ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SelettoreArea area={area} onCambio={(nuova) => {
          setArea(nuova);
          setZonaSelezionata(null);
          setZonaFocused(null);
          setComuneFocused('');
          setExpandedRows(new Set());
        }} />

        <button
          onClick={() => navigate('/valutazione')}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: 'var(--accent)',
            color: '#000',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          + Nuova Valutazione Immobiliare
        </button>
      </div>

      {isHinterland && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8 }}>
          Comuni: Quartu Sant'Elena, Selargius, Assemini, Capoterra, Monserrato, Quartucciu…
        </p>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isHinterland ? 'Comuni Monitorati' : 'Quartieri Monitorati'}
          value={zone.length}
          subtitle={isHinterland ? 'Cagliari Hinterland' : 'Cagliari Comune'}
        />
        <StatCard title="Prezzo Medio/mq" value={formatEuro(prezzoMedio)} subtitle="Media di mercato" />
        <StatCard title="Zona più Cara"
          value={formatEuro(prezzoMax)}
          subtitle={cleanNome(zone.find(z => parseFloat(z.prezzo_medio) === prezzoMax)?.descrizione_zona) ?? '–'}
          positive
        />
        <StatCard title="Zona più Economica"
          value={formatEuro(prezzoMin)}
          subtitle={cleanNome(zone.find(z => parseFloat(z.prezzo_medio) === prezzoMin)?.descrizione_zona) ?? '–'}
        />
      </div>

      {/* ── Filtri ─────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

        {/* Header filtri — separato dal contenuto con bordo */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>Filtri</p>
          {(filtri.fasce.length > 0 || filtri.prezzoMin || filtri.prezzoMax || filtri.roiVal || filtri.varOp || filtri.tipologia) && (
            <button
              onClick={() => setFiltri({ fasce: [], prezzoMin: '', prezzoMax: '', roiOp: '>', roiVal: '', varOp: '', tipologia: '' })}
              style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}
            >
              × Reset filtri
            </button>
          )}
        </div>

        {/* Contenuto filtri — padding generoso su tutti i lati */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, rowGap: 20, alignItems: 'flex-end' }}>

            {/* Toggle compravendita / locazione */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Modalità</p>
              <button
                onClick={() => setMostraLocazione(v => !v)}
                title={mostraLocazione ? 'Passa a compravendita' : 'Passa a locazione'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${mostraLocazione ? 'var(--accent)' : 'var(--border)'}`,
                  background: mostraLocazione ? 'rgba(245,158,11,0.12)' : 'var(--bg-secondary)',
                  color: mostraLocazione ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                  <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                {mostraLocazione ? 'Locazione' : 'Compravendita'}
              </button>
            </div>

            {/* Fascia */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Fascia</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {['A', 'B', 'C', 'D', 'E'].map(f => {
                  const sel = filtri.fasce.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() => setFiltri(prev => ({
                        ...prev,
                        fasce: sel ? prev.fasce.filter(x => x !== f) : [...prev.fasce, f],
                      }))}
                      style={{
                        width: 34, height: 34, borderRadius: 6, fontSize: 12, fontWeight: 700,
                        border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                        background: sel ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: sel ? '#000' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >{f}</button>
                  );
                })}
              </div>
            </div>

            {/* Prezzo min */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>{mostraLocazione ? 'Canone min €/mq' : 'Prezzo min €/mq'}</p>
              <input
                type="number" value={filtri.prezzoMin}
                onChange={e => setFiltri(p => ({ ...p, prezzoMin: e.target.value }))}
                placeholder="Es. 1000"
                style={{ width: 116, padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            {/* Prezzo max */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>{mostraLocazione ? 'Canone max €/mq' : 'Prezzo max €/mq'}</p>
              <input
                type="number" value={filtri.prezzoMax}
                onChange={e => setFiltri(p => ({ ...p, prezzoMax: e.target.value }))}
                placeholder="Es. 3000"
                style={{ width: 116, padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            {/* ROI */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>ROI annuo %</p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  value={filtri.roiOp}
                  onChange={e => setFiltri(p => ({ ...p, roiOp: e.target.value }))}
                  style={{ padding: '9px 10px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>
                <input
                  type="number" step="0.5" value={filtri.roiVal}
                  onChange={e => setFiltri(p => ({ ...p, roiVal: e.target.value }))}
                  placeholder="Es. 5"
                  style={{ width: 76, padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
              </div>
            </div>

            {/* Varianza vs media */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Vs. media mercato</p>
              <select
                value={filtri.varOp}
                onChange={e => setFiltri(p => ({ ...p, varOp: e.target.value }))}
                style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <option value="">Tutte le zone</option>
                <option value="sopra">Sopra media</option>
                <option value="sotto">Sotto media</option>
              </select>
            </div>

            {/* Tipologia / Abitazione */}
            {tipologie.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>Tipologia</p>
                <select
                  value={filtri.tipologia}
                  onChange={e => setFiltri(p => ({ ...p, tipologia: e.target.value }))}
                  style={{ width: 176, padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value="">Tutte le tipologie</option>
                  {tipologie.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {filtri.tipologia && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
                    Clicca una zona → analisi per tipologia
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Contatore risultati filtrati */}
          {(filtri.fasce.length > 0 || filtri.prezzoMin || filtri.prezzoMax || filtri.roiVal || filtri.varOp) && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              {zoneFiltrate.length} {isHinterland ? 'comuni' : 'quartieri'} corrispondono ai filtri applicati
            </p>
          )}
        </div>
      </div>

      {/* ── Layout principale: lista + right panel ─────────────────── */}
      <div className="flex gap-5 flex-col lg:flex-row items-start">

        {/* ── Lista ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {(zonaFocused || comuneFocused) && (
            <div className="flex items-center gap-2 mb-3">
              <span
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--accent)' }}
              >
                {zonaFocused ? `Quartiere: ${cleanNome(zonaFocused.descrizione_zona)}` : `Comune: ${comuneFocused}`}
              </span>
              <button
                onClick={() => { setZonaFocused(null); setComuneFocused(''); setZonaSelezionata(null); }}
                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                × Mostra tutti
              </button>
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {/* Intestazione */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridColonne,
                padding: '10px 20px',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                alignItems: 'center',
              }}
            >
              <span>#</span>
              <span>{isHinterland ? 'Comune' : 'Quartiere'}</span>
              <span>{mostraLocazione ? 'Locazione media' : 'Prezzo compravendita'}</span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                Fascia <InfoFascia />
              </span>
            </div>

            {/* Righe */}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {zoneFiltrate.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  Nessun risultato trovato
                </div>
              ) : (
                zoneFiltrate.map((zona, idx) => {
                  const nomeQuartiere = cleanNome(zona.descrizione_zona);
                  const isExpanded = expandedRows.has(zona.link_zona);
                  const rowBg = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)';
                  return (
                    <div key={zona.link_zona}>
                      {/* Riga principale */}
                      <div
                        onClick={() => {
                          if (filtri.tipologia) {
                            navigate(`/statistiche?nome=${encodeURIComponent(zona.descrizione_zona)}&tipo=${encodeURIComponent(filtri.tipologia)}`);
                          } else {
                            setZonaSelezionata(zona);
                          }
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: gridColonne,
                          alignItems: 'center',
                          padding: '12px 20px',
                          borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                          background: rowBg,
                          cursor: 'pointer',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                      >
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{idx + 1}</span>

                        <p style={{ fontSize: 14, fontWeight: 500, paddingRight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                          {isHinterland ? (zona.comune ?? '–') : nomeQuartiere}
                        </p>

                        <div style={{ paddingRight: 12 }}>
                          {(mostraLocazione ? zona.locazione_media : zona.prezzo_medio) ? (
                            <BarraPrezzo
                              valore={parseFloat(mostraLocazione ? zona.locazione_media : zona.prezzo_medio)}
                              min={valMin}
                              max={valMax}
                            />
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>–</span>
                          )}
                        </div>

                        {/* Fascia + expand (hinterland) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <BadgeFascia fascia={zona.fascia} />
                          {isHinterland && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(zona.link_zona); }}
                              style={{
                                width: 20, height: 20, borderRadius: 5,
                                background: isExpanded ? 'var(--accent-dim)' : 'rgba(255,255,255,0.07)',
                                color: isExpanded ? 'var(--accent)' : 'var(--text-muted)',
                                fontSize: 15, lineHeight: 1, border: '1px solid var(--border)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontWeight: 700,
                              }}
                              title={isExpanded ? 'Chiudi dettaglio' : 'Mostra quartiere OMI'}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Riga espansa: quartiere OMI */}
                      {isHinterland && isExpanded && (
                        <div style={{ padding: '8px 20px 8px 52px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                          Quartiere OMI:{' '}
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {nomeQuartiere || '–'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel: banner brand ─────────────────────────────── */}
        <div
          className="lg:w-72 shrink-0 rounded-xl flex flex-col items-center justify-center text-center overflow-hidden self-start"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minHeight: 200, position: 'relative' }}
        >
          <img src="/cagliari-hd.jpg" alt="Cagliari"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.18 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,17,23,0.2), rgba(15,17,23,0.72))' }} />
          <div className="relative z-10 flex flex-col items-center gap-2 px-5 py-7">
            {/* Logo DBI — brand banner panel */}
          <img src="/dbi-logo.png" alt="Daniel Balloi Immobiliare"
            style={{ height: 48, objectFit: 'contain', marginBottom: 4, filter: 'brightness(0) invert(1)' }} />
            <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: 18, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
              Daniel Balloi
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              Immobiliare
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              Seleziona un quartiere dalla lista per vederne i dettagli
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
