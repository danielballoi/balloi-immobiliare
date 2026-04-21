/**
 * DashboardMappa - Pagina principale
 *
 * Layout:
 *   1. Hero image con due barre di ricerca (Cagliari Città / Cagliari Provincia)
 *   2. Tab: Cagliari Comune | Cagliari Hinterland
 *   3. KPI cards aggregate
 *   4. Lista quartieri (Comune) con colonne adattive per area
 *   5. Pannello laterale: dettaglio zona selezionata
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useHeatmap from '../hooks/useHeatmap';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';


/** Rimuove gli apici iniziali/finali dai nomi zona OMI: 'POETTO' → POETTO */
const cleanNome = (s) => s?.replace(/^'+|'+$/g, '').trim() ?? '';

/** Barra gradiente verde→rosso proporzionale al prezzo */
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

/** Badge fascia OMI */
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

/** Popover con spiegazione delle fasce OMI */
function InfoFascia() {
  const [aperto, setAperto] = useState(false);

  const fasce = [
    { lettera: 'A', colore: '#f59e0b', nome: 'Pregio / Centro storico',    desc: 'Zone di massimo pregio, centro storico, alta domanda e prezzi elevati.' },
    { lettera: 'B', colore: '#3b82f6', nome: 'Semicentrale / Normale',     desc: 'Zone semicentrali con buon mix di servizi, prezzi nella media di mercato.' },
    { lettera: 'C', colore: '#94a3b8', nome: 'Periferica',                  desc: 'Zone periferiche della città, buona accessibilità ma lontane dal centro.' },
    { lettera: 'D', colore: '#10b981', nome: 'Extraurbana / Suburbana',     desc: 'Zone fuori dal centro urbano compatto, spesso residenziali o industriali.' },
    { lettera: 'E', colore: '#a855f7', nome: 'Agricola / Rurale',           desc: 'Zone a prevalente destinazione agricola o con carattere rurale.' },
  ];

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={() => setAperto(v => !v)}
        className="ml-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold leading-none"
        style={{ background: 'rgba(100,116,139,0.25)', color: 'var(--text-muted)' }}
        title="Significato fasce OMI"
      >
        i
      </button>

      {aperto && (
        <>
          {/* Overlay trasparente per chiudere cliccando fuori */}
          <div className="fixed inset-0 z-40" onClick={() => setAperto(false)} />

          <div
            className="absolute z-50 bottom-full mb-2 right-0 rounded-xl p-4 shadow-xl w-72"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Fasce OMI — Significato
            </p>
            <div className="flex flex-col gap-2">
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
        </>
      )}
    </div>
  );
}

/** Tab selector: Cagliari Comune | Cagliari Hinterland */
function SelettoreArea({ area, onCambio }) {
  const tabs = [
    { value: 'CAGLIARI',   label: 'Cagliari Comune' },
    { value: 'HINTERLAND', label: 'Cagliari Hinterland' },
  ];
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
      {tabs.map(tab => {
        const attivo = area === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onCambio(tab.value)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: attivo ? 'var(--accent)' : 'transparent',
              color:      attivo ? '#000' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DashboardMappa() {
  const navigate = useNavigate();

  // ── Stato ────────────────────────────────────────────────────────────────
  // Default: Cagliari Comune
  const [area, setArea]                       = useState('CAGLIARI');
  // Barra di ricerca unificata — un solo testo per l'area attiva
  const [filtro, setFiltro]                   = useState('');
  const [zonaSelezionata, setZonaSelezionata] = useState(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { zone, loading, errore } = useHeatmap(null, area);

  // ── KPI aggregate ────────────────────────────────────────────────────────
  const prezzi      = zone.map(z => parseFloat(z.prezzo_medio)).filter(Boolean);
  const prezzoMin   = prezzi.length ? Math.min(...prezzi) : 0;
  const prezzoMax   = prezzi.length ? Math.max(...prezzi) : 1;
  const prezzoMedio = prezzi.length ? prezzi.reduce((a, b) => a + b, 0) / prezzi.length : 0;

  // ── Filtro testo ricerca ─────────────────────────────────────────────────
  const zoneFiltrate = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return zone;
    return zone.filter(z =>
      cleanNome(z.descrizione_zona)?.toLowerCase().includes(q) ||
      z.comune?.toLowerCase().includes(q)
    );
  }, [zone, filtro]);

  // ── Colonne griglia adattive ─────────────────────────────────────────────
  // Cagliari:  # | Quartiere | Prezzo | Fascia
  // Hinterland: # | Comune | Prezzo | Quartiere | Fascia
  const isHinterland = area === 'HINTERLAND';
  const gridColonne  = isHinterland ? '2.5rem 1fr 1fr 1fr 4rem' : '2.5rem 1fr 1fr 4rem';

  if (loading) return <LoadingSpinner text="Caricamento dati OMI..." />;

  if (errore) return (
    <div className="flex items-center justify-center h-64 text-center px-4">
      <div>
        <p className="mb-4 text-sm" style={{ color: 'var(--danger)' }}>⚠ {errore}</p>
        <button onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#000' }}>
          Riprova
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* ── Hero image ──────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ height: 280 }}>
        <img src="/cagliari-hd.jpg" alt="Cagliari skyline"
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(15,17,23,0.25) 0%, rgba(15,17,23,0.82) 100%)' }} />

        <div className="absolute inset-0 flex flex-col p-6 gap-4">

          {/* Riga top: titolo sinistra + bottone Nuova Valutazione destra */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                Mercato Immobiliare
                {area === 'HINTERLAND' ? ' — Cagliari Hinterland' : ' — Cagliari Comune'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.70)' }}>
                Dati OMI aggiornati · {zone.length} {isHinterland ? 'comuni' : 'quartieri'} monitorati
              </p>
            </div>
            <button
              onClick={() => navigate('/valutazione')}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              + Nuova Valutazione
            </button>
          </div>

          {/* Barra di ricerca centrata e prominente — senza toggle area */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-lg">
              <div
                className="flex items-center rounded-xl"
                style={{
                  background: 'rgba(15,17,23,0.65)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.20)',
                }}
              >
                <svg
                  className="ml-4 w-4 h-4 shrink-0 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  placeholder={area === 'CAGLIARI' ? 'Cerca quartiere in Cagliari…' : "Cerca comune nell'Hinterland…"}
                  className="flex-1 px-3 py-3 text-sm placeholder:text-white/40 bg-transparent"
                  style={{ color: '#fff', outline: 'none' }}
                />
                {/* Bottone X per svuotare la ricerca velocemente */}
                {filtro && (
                  <button
                    onClick={() => setFiltro('')}
                    className="mr-3 w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none"
                    style={{ background: 'rgba(255,255,255,0.20)', color: '#fff' }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Tab selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SelettoreArea area={area} onCambio={(nuova) => { setZonaSelezionata(null); setArea(nuova); setFiltro(''); }} />
        {isHinterland && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Comuni: Quartu Sant'Elena, Selargius, Assemini, Capoterra, Monserrato, Quartucciu…
          </p>
        )}
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isHinterland ? 'Comuni Monitorati' : 'Quartieri Monitorati'}
          value={zone.length}
          subtitle={isHinterland ? 'Cagliari Hinterland' : 'Cagliari Comune'}
        />
        <StatCard title="Prezzo Medio/mq"  value={formatEuro(prezzoMedio)} subtitle="Media di mercato" />
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

      {/* ── Layout principale ────────────────────────────────────────────── */}
      <div className="flex gap-5 flex-col lg:flex-row items-start">

        {/* ── Lista quartieri / comuni ──────────────────────────────────── */}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>

          {/* Intestazione colonne */}
          <div
            className="grid px-5 py-3 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10"
            style={{
              gridTemplateColumns: gridColonne,
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <span>#</span>
            {/* Hinterland: prima COMUNE poi Quartiere — Cagliari: solo Quartiere */}
            <span>{isHinterland ? 'Comune' : 'Quartiere'}</span>
            <span>Prezzo compravendita</span>
            {isHinterland && <span>Quartiere</span>}
            {/* Icona (i) sulla fascia */}
            <span className="text-center flex items-center justify-center gap-0.5">
              Fascia <InfoFascia />
            </span>
          </div>

          {/* Righe */}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {zoneFiltrate.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nessun risultato per "{filtro}"
                </p>
              </div>
            ) : (
              zoneFiltrate.map((zona, idx) => {
                const selezionato = zonaSelezionata?.link_zona === zona.link_zona;
                const nomeQuartiere = cleanNome(zona.descrizione_zona);
                return (
                  <div
                    key={zona.link_zona}
                    onClick={() => setZonaSelezionata(selezionato ? null : zona)}
                    className="grid items-center px-5 py-3 cursor-pointer"
                    style={{
                      gridTemplateColumns: gridColonne,
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                      background: selezionato
                        ? 'rgba(245,158,11,0.08)'
                        : idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{idx + 1}</span>

                    {/* Prima colonna: Comune (hinterland) o Quartiere (cagliari) */}
                    <p className="text-sm font-medium pr-4 truncate"
                      style={{ color: selezionato ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {isHinterland ? (zona.comune ?? '–') : nomeQuartiere}
                    </p>

                    {/* Prezzo */}
                    <div className="pr-4">
                      {zona.prezzo_medio ? (
                        <BarraPrezzo valore={parseFloat(zona.prezzo_medio)} min={prezzoMin} max={prezzoMax} />
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </div>

                    {/* Seconda colonna Hinterland: Quartiere in secondo piano */}
                    {isHinterland && (
                      <span className="text-xs truncate pr-2" style={{ color: 'var(--text-muted)' }}>
                        {nomeQuartiere}
                      </span>
                    )}

                    <div className="flex justify-center">
                      <BadgeFascia fascia={zona.fascia} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Pannello dettaglio ────────────────────────────────────────── */}
        <div
          className="lg:w-80 shrink-0 rounded-xl flex flex-col gap-4 self-start"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.25rem' }}
        >
          {!zonaSelezionata ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center py-14">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--bg-secondary)' }}>
                <svg className="w-7 h-7 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Seleziona Quartiere & Comune
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Clicca su una riga per vedere prezzi e analisi storica dal 2020
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Hinterland: comune come titolo, quartiere come sottotitolo */}
                  {isHinterland ? (
                    <>
                      <h3 className="font-bold text-base leading-tight truncate" style={{ color: 'var(--accent)' }}>
                        {zonaSelezionata.comune ?? '–'}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {cleanNome(zonaSelezionata.descrizione_zona)}
                      </p>
                    </>
                  ) : (
                    <h3 className="font-bold text-base leading-tight truncate" style={{ color: 'var(--accent)' }}>
                      {cleanNome(zonaSelezionata.descrizione_zona)}
                    </h3>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <BadgeFascia fascia={zonaSelezionata.fascia} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fascia {zonaSelezionata.fascia ?? '–'}</span>
                  </div>
                </div>
                <button onClick={() => setZonaSelezionata(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-base leading-none shrink-0"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                  ×
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Statistiche Quartiere & Comune */}
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Statistiche Quartiere & Comune
              </p>

              <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Compravendita
                </p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatEuro(zonaSelezionata.prezzo_medio)}
                  <span className="text-sm font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>/mq</span>
                </p>
              </div>

              {zonaSelezionata.locazione_media && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Locazione
                  </p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatEuro(zonaSelezionata.locazione_media)}
                    <span className="text-sm font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>/mq/mese</span>
                  </p>
                </div>
              )}

              {zonaSelezionata.prezzo_medio && prezzoMedio > 0 && (() => {
                const diff = ((parseFloat(zonaSelezionata.prezzo_medio) - prezzoMedio) / prezzoMedio) * 100;
                const sopra = diff > 0;
                return (
                  <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Vs. Media Mercato
                    </p>
                    <p className="text-sm font-semibold" style={{ color: sopra ? 'var(--danger)' : 'var(--success)' }}>
                      {sopra ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                      <span className="text-xs font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>
                        {sopra ? 'sopra' : 'sotto'} la media
                      </span>
                    </p>
                  </div>
                );
              })()}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => navigate(`/statistiche?nome=${encodeURIComponent(zonaSelezionata.descrizione_zona)}`)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  Analisi storica 2020–2025 →
                </button>
                <button
                  onClick={() => navigate(`/valutazione?zona=${zonaSelezionata.link_zona}`)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  Valuta Immobile →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
