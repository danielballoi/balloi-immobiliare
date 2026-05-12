/**
 * StatisticheQuartiere - Analisi dettagliata di un quartiere OMI
 *
 * Accetta due modalità di navigazione da URL:
 *   ?nome=MONTE URPINU  → usato dalla Dashboard (nome quartiere)
 *   ?zona=CA00003353    → compatibilità con link vecchi (codice zona)
 *
 * Data fetching delegato a due hook:
 *   - useHeatmap  → lista quartieri per il selettore dropdown
 *   - useStatistiche → statistiche + trend del quartiere selezionato
 *
 * Mostra:
 *   - KPI principali (prezzo medio, canone, ROI stimato)
 *   - Grafico trend prezzi annuale 2020–2025
 *   - Tabella analisi per tipologia e stato
 *   - Indice Rischio/Opportunità (calcolato localmente)
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import useHeatmap      from '../hooks/useHeatmap';
import useStatistiche  from '../hooks/useStatistiche';
import StatCard        from '../components/StatCard';
import LoadingSpinner  from '../components/LoadingSpinner';
import EmptyState      from '../components/EmptyState';

const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';

/** Tooltip personalizzato per il grafico Recharts */
function TooltipGrafico({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 text-xs shadow-xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Anno {label}
      </p>
      {payload.map(p => (
        <p key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ color: p.color }}>{formatEuro(p.value)}/mq</span>
        </p>
      ))}
    </div>
  );
}

// ── Modal: zona senza dati disponibili ───────────────────────────────────
// Appare automaticamente quando il quartiere/comune selezionato non ha dati OMI.
function ModalDatiMancanti({ onChiudi, prezzoCompravendita, locazione }) {
  const navigate = useNavigate();
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onChiudi} />
      <div className="modal-box modal-box-sm">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>📊</span>
            <h2 className="modal-title">Dati non disponibili</h2>
          </div>
          <button className="modal-close" onClick={onChiudi}>×</button>
        </div>

        {/* Body */}
        <div className="modal-body-col">
          <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-muted)' }}>
            Non abbiamo ancora raccolto dati sufficienti per elaborare un'analisi tecnica per questo quartiere o comune.
          </p>

          {/* Valori medi se disponibili */}
          {(prezzoCompravendita > 0 || locazione > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {prezzoCompravendita > 0 && (
                <div style={{ padding: '14px 12px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Prezzo Compravendita
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                    {`€ ${Number(prezzoCompravendita).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/mq</span>
                  </p>
                </div>
              )}
              {locazione > 0 && (
                <div style={{ padding: '14px 12px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Locazione Media
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--info)' }}>
                    {`€ ${parseFloat(locazione).toFixed(1)}`}
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/mq/m</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="modal-footer" style={{ borderTop: 'none', padding: 0, justifyContent: 'center' }}>
            <button
              onClick={onChiudi}
              className="btn-touch"
              style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              Chiudi
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-touch"
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              Torna alla Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calcolatrice professionale ────────────────────────────────────────────
function CalcolatriceModal({ onChiudi }) {
  const [display, setDisplay]               = useState('0');
  const [operazione, setOperazione]         = useState('');
  const [valoreIn, setValoreIn]             = useState(null);
  const [resettaDisplay, setResettaDisplay] = useState(false);
  const [espressione, setEspressione]       = useState('');

  // Formatta il numero nel display con localizzazione italiana
  const formatDisplay = (str) => {
    if (str === 'Errore') return 'Errore';
    if (str.endsWith('.')) {
      const n = parseFloat(str);
      return (isNaN(n) ? '0' : n.toLocaleString('it-IT')) + ',';
    }
    const num = parseFloat(str);
    if (isNaN(num)) return str;
    const decimali = str.includes('.') ? str.split('.')[1].length : 0;
    return num.toLocaleString('it-IT', {
      minimumFractionDigits: Math.min(decimali, 10),
      maximumFractionDigits: 10,
    });
  };

  const premCifra = (c) => {
    if (resettaDisplay) {
      setDisplay(c === '.' ? '0.' : c);
      setResettaDisplay(false);
    } else {
      if (c === '.' && display.includes('.')) return;
      setDisplay(display === '0' && c !== '.' ? c : display + c);
    }
  };

  const calcola = (a, b, op) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 'Errore';
      default:  return b;
    }
  };

  const premOp = (op) => {
    const val = parseFloat(display);
    let newVal = valoreIn;
    if (valoreIn !== null && !resettaDisplay) {
      const ris = calcola(valoreIn, val, operazione);
      newVal = typeof ris === 'number' ? ris : null;
      setDisplay(typeof ris === 'number' ? String(parseFloat(ris.toFixed(10))) : String(ris));
    } else {
      newVal = isNaN(val) ? 0 : val;
    }
    setValoreIn(newVal);
    setOperazione(op);
    setEspressione(newVal !== null
      ? `${formatDisplay(String(newVal))} ${op === '-' ? '−' : op}`
      : '');
    setResettaDisplay(true);
  };

  const premUguali = () => {
    if (valoreIn === null) return;
    const val = parseFloat(display);
    const ris = calcola(valoreIn, val, operazione);
    const opLabel = operazione === '-' ? '−' : operazione;
    setEspressione(`${formatDisplay(String(valoreIn))} ${opLabel} ${formatDisplay(display)} =`);
    const displayRis = typeof ris === 'number'
      ? String(parseFloat(ris.toFixed(10)))
      : String(ris);
    setDisplay(displayRis);
    setValoreIn(null);
    setOperazione('');
    setResettaDisplay(true);
  };

  const premC = () => {
    setDisplay('0');
    setValoreIn(null);
    setOperazione('');
    setEspressione('');
    setResettaDisplay(false);
  };

  const premPlusMinus = () => {
    if (display === 'Errore' || display === '0') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display);
  };

  const premPerc = () => {
    const n = parseFloat(display);
    if (!isNaN(n)) setDisplay(String(n / 100));
  };

  const displayLen = display.replace('-', '').replace('.', '').length;
  const fontSize = displayLen > 12 ? 20 : displayLen > 9 ? 26 : displayLen > 6 ? 32 : 40;

  const TASTI = [
    [
      { label: 'C',   fn: premC,             tipo: 'func' },
      { label: '+/-', fn: premPlusMinus,     tipo: 'func' },
      { label: '%',   fn: premPerc,          tipo: 'func' },
      { label: '÷',   fn: () => premOp('÷'), tipo: 'op', op: '÷' },
    ],
    [
      { label: '7', fn: () => premCifra('7'), tipo: 'num' },
      { label: '8', fn: () => premCifra('8'), tipo: 'num' },
      { label: '9', fn: () => premCifra('9'), tipo: 'num' },
      { label: '×', fn: () => premOp('×'),   tipo: 'op', op: '×' },
    ],
    [
      { label: '4', fn: () => premCifra('4'), tipo: 'num' },
      { label: '5', fn: () => premCifra('5'), tipo: 'num' },
      { label: '6', fn: () => premCifra('6'), tipo: 'num' },
      { label: '−', fn: () => premOp('-'),    tipo: 'op', op: '-' },
    ],
    [
      { label: '1', fn: () => premCifra('1'), tipo: 'num' },
      { label: '2', fn: () => premCifra('2'), tipo: 'num' },
      { label: '3', fn: () => premCifra('3'), tipo: 'num' },
      { label: '+', fn: () => premOp('+'),    tipo: 'op', op: '+' },
    ],
    [
      { label: '0', fn: () => premCifra('0'), tipo: 'num', wide: true },
      { label: ',', fn: () => premCifra('.'), tipo: 'num' },
      { label: '=', fn: premUguali,           tipo: 'eq'  },
    ],
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onChiudi} />
      <div style={{
        position: 'relative', zIndex: 1001,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 24, overflow: 'hidden',
        width: 'min(340px, 92vw)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}>
        {/* Header calcolatrice */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <line x1="8" y1="6" x2="16" y2="6"/>
              <line x1="16" y1="14" x2="16" y2="18"/>
              <path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>
              <path d="M8 14h.01"/><path d="M12 14h.01"/>
              <path d="M8 18h.01"/><path d="M12 18h.01"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Calcolatrice</span>
          </div>
          <button onClick={onChiudi} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
            lineHeight: 1, padding: '4px 9px', borderRadius: 8,
          }}>×</button>
        </div>

        {/* Display numerico */}
        <div style={{
          padding: '16px 20px 14px', background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)', textAlign: 'right',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', height: 16, marginBottom: 6, opacity: 0.65 }}>
            {espressione}
          </div>
          <div style={{
            fontSize, fontWeight: 700, lineHeight: 1.2,
            color: display === 'Errore' ? 'var(--danger)' : 'var(--text-primary)',
            fontFamily: "'SF Mono', 'Consolas', monospace",
            letterSpacing: '-0.02em', wordBreak: 'break-all',
            transition: 'font-size 0.1s',
          }}>
            {formatDisplay(display)}
          </div>
        </div>

        {/* Tastierino */}
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-card)' }}>
          {TASTI.map((riga, ri) => (
            <div key={ri} style={{
              display: 'grid',
              gridTemplateColumns: riga.some(t => t.wide) ? '2fr 1fr 1fr' : '1fr 1fr 1fr 1fr',
              gap: 6,
            }}>
              {riga.map((t, ti) => {
                const isOp    = t.tipo === 'op';
                const isEq    = t.tipo === 'eq';
                const isFunc  = t.tipo === 'func';
                const isAttivo = isOp && operazione === t.op;
                return (
                  <button key={ti} onClick={t.fn}
                    style={{
                      padding: '17px 0', borderRadius: 10, fontSize: 18,
                      fontWeight: isEq ? 700 : isOp ? 600 : 400,
                      cursor: 'pointer', border: 'none', outline: 'none',
                      transition: 'opacity 0.08s, transform 0.05s',
                      background: isEq      ? 'var(--accent)'
                        : isAttivo          ? 'rgba(245,158,11,0.28)'
                        : isOp              ? 'rgba(245,158,11,0.10)'
                        : isFunc            ? 'var(--bg-secondary)'
                        :                     'var(--bg-elevated)',
                      color: isEq           ? '#000'
                        : isOp              ? 'var(--accent)'
                        : isFunc            ? 'var(--text-secondary)'
                        :                     'var(--text-primary)',
                      boxShadow: isEq ? '0 2px 10px rgba(245,158,11,0.3)' : 'none',
                    }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.opacity = '0.75'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = ''; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = ''; }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.93)'; e.currentTarget.style.opacity = '0.75'; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = ''; }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StatisticheQuartiere() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Legge sia ?nome= (dalla dashboard) che ?zona= (link vecchi)
  const nomeParam = searchParams.get('nome');
  const zonaParam = searchParams.get('zona');

  // Stato locale: nome quartiere selezionato (può essere impostato da URL o dal selettore)
  const [zonaSelezionata, setZonaSelezionata] = useState(nomeParam || '');

  // ── Modal dati mancanti: si apre quando la zona non ha dati OMI ──────────
  const [showModalDatiMancanti, setShowModalDatiMancanti] = useState(false);

  // ── Calcolatrice: aperta dal pulsante accanto al titolo della tabella ────
  const [showCalcolatrice, setShowCalcolatrice] = useState(false);

  // ── Stato per la barra di ricerca avanzata ───────────────────────────────
  // areaRicerca: quale gruppo mostrare nel dropdown (CAGLIARI o HINTERLAND)
  const [areaRicerca,    setAreaRicerca]    = useState('CAGLIARI');
  // testoCerca: testo digitato dall'utente nell'input
  const [testoCerca,     setTestoCerca]     = useState(nomeParam || '');
  // dropdownAperto: controlla visibilità del dropdown autocomplete
  const [dropdownAperto, setDropdownAperto] = useState(false);

  // ── Hook: lista quartieri per il selettore ───────────────────────────────
  // area=null + comune=null → nessun filtro → carica Cagliari + Hinterland
  const { zone, loading: loadingZone } = useHeatmap(null, null);

  // ── Gestione compatibilità ?zona=CODICE (link vecchi) ────────────────────
  // Se arriva un codice zona, trova il nome corrispondente nella lista
  const zonaTrovata = zonaParam && !nomeParam && !zonaSelezionata
    ? (zone.find(z => z.link_zona === zonaParam)?.descrizione_zona || '')
    : null;
  // Usa il nome trovato se non c'è già una selezione
  const nomeEffettivo = zonaSelezionata || zonaTrovata || '';

  // ── Comune della zona selezionata (necessario per Hinterland) ───────────
  // Calcolato da zone (che include sia Cagliari che Hinterland) per passarlo
  // a useStatistiche, altrimenti le query userebbero sempre "Cagliari".
  const comuneZona = useMemo(() => {
    if (!nomeEffettivo || !zone.length) return 'Cagliari';
    return zone.find(z => z.descrizione_zona === nomeEffettivo)?.comune || 'Cagliari';
  }, [zone, nomeEffettivo]);

  // ── Hook: statistiche + trend del quartiere ──────────────────────────────
  // Aspetta che zone sia caricato (loadingZone=false) prima di passare nomeEffettivo
  // a useStatistiche. Questo garantisce che comuneZona sia già corretto (es. Hinterland),
  // evitando il doppio fetch: 1° con comune='Cagliari' (sbagliato), 2° con comune corretto.
  const { statistiche, trend, loading } = useStatistiche(
    !loadingZone ? nomeEffettivo : '',
    comuneZona
  );

  // ── KPI aggregati (solo stato NORMALE + tipologie residenziali standard) ──
  // Req 1: calcola prezzi medi solo su "abitazioni civili" e "abitazioni economiche"
  const TIPOLOGIE_KPI = ['abitazioni civili', 'abitazioni economiche'];
  const righeNormali = statistiche.filter(r =>
    r.stato === 'NORMALE' &&
    TIPOLOGIE_KPI.some(t => r.descrizione_tipologia?.toLowerCase().includes(t))
  );
  const prezzoMedioNormale = righeNormali.length
    ? righeNormali.reduce((s, r) => s + parseFloat(r.prezzo_medio_mq || 0), 0) / righeNormali.length
    : 0;
  const locazioneMedioNormale = righeNormali.length
    ? righeNormali.reduce((s, r) => s + parseFloat(r.locazione_media_mq || 0), 0) / righeNormali.length
    : 0;
  // ROI lordo: rendita annua / valore × 100
  const roiLordo = prezzoMedioNormale > 0 && locazioneMedioNormale > 0
    ? ((locazioneMedioNormale * 12) / prezzoMedioNormale) * 100
    : 0;

  // ── Indice Opportunità (0-100): composto da ROI + dati + base garantita ──
  const indiceOpportunita = Math.min(100, Math.round(
    (roiLordo / 10) * 40 +
    (righeNormali.length / 5) * 30 +
    30
  ));

  const infoZona = zone.find(z => z.descrizione_zona === nomeEffettivo);

  // ── Suggerimenti autocomplete ─────────────────────────────────────────────
  // Filtra per area selezionata, poi per testo digitato (max 10 risultati)
  const zoneSuggerite = useMemo(() => {
    const zoneArea = areaRicerca === 'HINTERLAND'
      ? zone.filter(z => z.area === 'HINTERLAND')
      : zone.filter(z => z.area === 'CAGLIARI' || !z.area);
    if (!testoCerca.trim()) return zoneArea.slice(0, 8);
    const q = testoCerca.toLowerCase();
    return zoneArea.filter(z =>
      z.descrizione_zona?.toLowerCase().includes(q) ||
      z.comune?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [zone, areaRicerca, testoCerca]);

  // Imposta l'area corretta nel toggle quando si arriva da URL con ?nome=
  useEffect(() => {
    if (nomeEffettivo && zone.length > 0) {
      const zonaInfo = zone.find(z => z.descrizione_zona === nomeEffettivo);
      if (zonaInfo?.area) setAreaRicerca(zonaInfo.area);
    }
  }, [zone, nomeEffettivo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apre il modal se la zona selezionata non ha dati OMI disponibili
  useEffect(() => {
    if (loading || !nomeEffettivo) {
      setShowModalDatiMancanti(false);
      return;
    }
    if (statistiche.length === 0) {
      console.log(`[STATISTICHE] Nessun dato OMI per "${nomeEffettivo}", mostro modal dati mancanti`);
      setShowModalDatiMancanti(true);
    } else {
      setShowModalDatiMancanti(false);
    }
  }, [loading, nomeEffettivo, statistiche.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aggiorna URL e stato quando l'utente seleziona un quartiere
  const onCambioZona = (nome) => {
    setZonaSelezionata(nome);
    setSearchParams(nome ? { nome } : {});
    // Sincronizza anche l'input testo con il nome selezionato
    setTestoCerca(nome);
    setDropdownAperto(false);
  };

  // ── Variazione percentuale primo→ultimo anno nel trend ─────────────────
  const variazionePerc = trend.length >= 2
    ? ((trend.at(-1).prezzo_medio_mq - trend[0].prezzo_medio_mq) / trend[0].prezzo_medio_mq) * 100
    : null;

  return (
    <div className="page-content">

      {/* Modal dati mancanti — appare se la zona non ha dati OMI sufficienti */}
      {showModalDatiMancanti && (
        <ModalDatiMancanti
          onChiudi={() => setShowModalDatiMancanti(false)}
          prezzoCompravendita={prezzoMedioNormale}
          locazione={locazioneMedioNormale}
        />
      )}

      {/* Calcolatrice — aperta dal pulsante accanto a "Analisi per Tipologia" */}
      {showCalcolatrice && (
        <CalcolatriceModal onChiudi={() => setShowCalcolatrice(false)} />
      )}

      {/* ── Intestazione ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Statistiche Quartiere
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Analisi prezzi e andamento storico per zona OMI
          </p>
        </div>

      </div>

      {/* ── Contenuto principale ─────────────────────────────────────────── */}
      {!nomeEffettivo ? (
        <EmptyState
          icon="🗺️"
          title="Seleziona un quartiere"
          message="Scegli un quartiere dal menu in alto per visualizzare statistiche e andamento storico."
        />
      ) : (loading || loadingZone) ? (
        <LoadingSpinner text={`Caricamento dati ${nomeEffettivo}…`} />
      ) : (
        <>
          {/* Breadcrumb — cleanNome rimuove apostrofi iniziali/finali */}
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hover:underline"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {infoZona?.comune && infoZona.comune !== 'Cagliari' ? infoZona.comune : 'Cagliari'}
            </button>
            <span>›</span>
            <span style={{ color: 'var(--accent)' }}>
              {nomeEffettivo?.replace(/^'+|'+$/g, '').trim() ?? nomeEffettivo}
            </span>
            {infoZona?.fascia && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                Fascia {infoZona.fascia}
              </span>
            )}
          </div>

          {/* ── KPI Cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Prezzo Medio/mq"
              value={formatEuro(prezzoMedioNormale)}
              subtitle="Stato normale · anno attuale"
            />
            <StatCard
              title="Canone Medio/mq"
              value={locazioneMedioNormale ? `€ ${locazioneMedioNormale.toFixed(1)}` : '–'}
              subtitle="€/mq/mese"
            />
            <StatCard
              title="ROI Lordo Stimato"
              value={roiLordo ? `${roiLordo.toFixed(1)}%` : '–'}
              positive={roiLordo > 5}
              subtitle="Rendimento annuo lordo"
            />
            <StatCard
              title="Variazione 2020–oggi"
              value={variazionePerc !== null ? `${variazionePerc > 0 ? '+' : ''}${variazionePerc.toFixed(1)}%` : '–'}
              positive={variazionePerc > 0}
              subtitle="Trend prezzi compravendita"
            />
          </div>

          {/* ── Grafico trend + indice opportunità ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Grafico AreaChart (occupa 2/3) */}
            <div className="lg:col-span-2 chart-card">
              {/* Header */}
              <div className="chart-card-header">
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Andamento Prezzi Storici · {nomeEffettivo?.replace(/^'+|'+$/g, '').trim()}
                </h2>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  2020 – 2025
                </span>
              </div>
              {/* Contenuto */}
              <div className="chart-card-body">
                {trend.length === 0 ? (
                  <EmptyState
                    icon="📊"
                    title="Nessun dato storico"
                    message="Non ci sono dati di trend disponibili per questo quartiere."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradCompra" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradLoc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.20} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      {/* vertical={false}: riduce rumore visivo su mobile */}
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="anno"
                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={false}
                      />
                      {/* width={52}: evita che i tick €XXk vengano tagliati su mobile */}
                      <YAxis
                        width={52}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`}
                      />
                      <Tooltip content={<TooltipGrafico />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 16 }} />
                      <Area
                        type="monotone"
                        dataKey="prezzo_medio_mq"
                        name="Compravendita €/mq"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fill="url(#gradCompra)"
                        dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="locazione_media_mq"
                        name="Locazione €/mq/mese"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#gradLoc)"
                        dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Indice Rischio/Opportunità (1/3) */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}
            >
              {/* Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Indice Opportunità
                </h2>
              </div>
              {/* Contenuto */}
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none"
                        stroke="var(--border)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.9"
                        fill="none"
                        stroke={
                          indiceOpportunita > 70 ? 'var(--success)'
                            : indiceOpportunita > 40 ? 'var(--warning)'
                            : 'var(--danger)'
                        }
                        strokeWidth="3"
                        strokeDasharray={`${indiceOpportunita} 100`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {indiceOpportunita}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/100</span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 20,
                      background: indiceOpportunita > 70
                        ? 'rgba(16,185,129,0.12)'
                        : indiceOpportunita > 40 ? 'rgba(245,158,11,0.12)'
                        : 'rgba(239,68,68,0.12)',
                      color: indiceOpportunita > 70 ? 'var(--success)'
                        : indiceOpportunita > 40 ? 'var(--warning)'
                        : 'var(--danger)',
                    }}
                  >
                    {indiceOpportunita > 70 ? 'Alta Opportunità'
                      : indiceOpportunita > 40 ? 'Opportunità Media'
                      : 'Bassa Opportunità'}
                  </span>
                </div>

                {/* Metriche 2×2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'ROI lordo',            val: `${roiLordo.toFixed(1)}%`,   color: roiLordo > 5 ? 'var(--success)' : 'var(--warning)' },
                    { label: 'Tipologie analizzate', val: statistiche.length,           color: 'var(--text-primary)' },
                    { label: 'Anni di storico',      val: trend.length,                 color: 'var(--text-primary)' },
                    { label: 'Variazione mercato',   val: variazionePerc !== null ? `${variazionePerc > 0 ? '+' : ''}${variazionePerc.toFixed(1)}%` : '–', color: variazionePerc > 0 ? 'var(--success)' : 'var(--danger)' },
                  ].map(({ label, val, color }) => (
                    <div
                      key={label}
                      style={{ borderRadius: 10, padding: '12px 10px', textAlign: 'center', background: 'var(--bg-secondary)' }}
                    >
                      <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, marginBottom: 6, color }}>{val}</p>
                      <p style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabella analisi per tipologia ─────────────────────────────── */}
          {statistiche.length > 0 && (
            <div className="card-section">

              {/* ZONA 1 — header */}
              <div className="card-section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    Analisi per Tipologia · Anno più recente
                  </h2>
                  {/* Pulsante calcolatrice */}
                  <button
                    onClick={() => setShowCalcolatrice(true)}
                    title="Apri calcolatrice"
                    style={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '4px 7px', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2"/>
                      <line x1="8" y1="6" x2="16" y2="6"/>
                      <line x1="16" y1="14" x2="16" y2="18"/>
                      <path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>
                      <path d="M8 14h.01"/><path d="M12 14h.01"/>
                      <path d="M8 18h.01"/><path d="M12 18h.01"/>
                    </svg>
                  </button>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Clicca su una riga per vedere l'andamento storico →
                </span>
              </div>

              {/* ZONA 2 — tabella */}
              <div className="overflow-x-auto">
                <table className="w-full table-responsive">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                      {['Tipologia', 'Stato', 'Min €/mq', 'Medio €/mq', 'Max €/mq', 'Loc. €/mq/m'].map(h => (
                        <th
                          key={h}
                          style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statistiche.map((r, i) => (
                      <tr
                        key={i}
                        onClick={() =>
                          navigate(
                            `/tipologia?nome=${encodeURIComponent(nomeEffettivo)}&tipo=${encodeURIComponent(r.descrizione_tipologia)}&stato=${r.stato}&comune=${encodeURIComponent(comuneZona)}`
                          )
                        }
                        style={{
                          background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                          borderTop: '1px solid var(--border)',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)'}
                      >
                        <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--accent)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {r.descrizione_tipologia}
                            <svg style={{ width: 12, height: 12, opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span
                            style={{
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: r.stato === 'OTTIMO' ? 'rgba(16,185,129,0.15)'
                                : r.stato === 'SCADENTE' ? 'rgba(239,68,68,0.15)'
                                : 'rgba(245,158,11,0.15)',
                              color: r.stato === 'OTTIMO' ? 'var(--success)'
                                : r.stato === 'SCADENTE' ? 'var(--danger)'
                                : 'var(--warning)',
                            }}
                          >
                            {r.stato}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-muted)' }}>{formatEuro(r.prezzo_min)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatEuro(r.prezzo_medio_mq)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-muted)' }}>{formatEuro(r.prezzo_max)}</td>
                        <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-muted)' }}>
                          {r.locazione_media_mq ? `€ ${parseFloat(r.locazione_media_mq).toFixed(1)}` : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
