/**
 * DettaglioTipologia - Analisi storica annuale per una tipologia immobiliare
 *
 * Route: /tipologia?nome=MARINA - STAMPACE&tipo=Abitazioni civili&stato=NORMALE
 *
 * Risponde alla domanda:
 *   "Come è cambiato il prezzo delle Abitazioni Civili a Marina dal 2020 al 2025?"
 *
 * NB sui dati OMI:
 *   Il database contiene rilevazioni di prezzi di mercato (campioni semestrali
 *   dell'Agenzia delle Entrate), NON il numero di immobili venduti/locati.
 *   "Rilevazioni OMI" = quanti campioni di prezzo esistono per quell'anno nella zona.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getTipologiaAnnuale, getNTNZona } from '../services/api';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';

const fmt1 = (n) =>
  n ? parseFloat(n).toFixed(1) : '–';

/** Tooltip custom per il grafico */
function TooltipDettaglio({ active, payload, label }) {
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

export default function DettaglioTipologia() {
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();

  // Parametri dall'URL: nome quartiere + tipologia + stato
  const nome  = searchParams.get('nome')  || '';
  const tipo  = searchParams.get('tipo')  || '';
  const stato = searchParams.get('stato') || 'NORMALE';

  const [dati, setDati]         = useState([]);
  const [ntn, setNtn]           = useState([]);   // volumi transazioni per anno
  const [loading, setLoading]   = useState(true);
  const [errore, setErrore]     = useState(null);

  // ── Caricamento dati storici per la tipologia ──────────────────────────
  useEffect(() => {
    if (!nome || !tipo) return;
    console.log(`[DETTAGLIO-TIP] ${tipo} in ${nome} (${stato})`);
    setLoading(true);

    // Carica prezzi storici + volumi NTN in parallelo
    Promise.all([
      getTipologiaAnnuale({ nome, tipo, stato }),
      getNTNZona(nome, tipo),
    ])
      .then(([rows, ntnRows]) => {
        console.log(`[DETTAGLIO-TIP] Prezzi: ${rows.length} anni, NTN: ${ntnRows.length} anni`);
        setDati(rows.map(r => ({
          ...r,
          prezzo_medio_mq:    Math.round(r.prezzo_medio_mq    || 0),
          prezzo_min:         Math.round(r.prezzo_min          || 0),
          prezzo_max:         Math.round(r.prezzo_max          || 0),
          locazione_media_mq: parseFloat(r.locazione_media_mq || 0).toFixed(1),
        })));
        // Mappa NTN per anno per un lookup rapido O(1)
        const ntnMap = {};
        ntnRows.forEach(r => { ntnMap[r.anno] = r; });
        setNtn(ntnMap);
      })
      .catch(err => {
        console.error('[DETTAGLIO-TIP] Errore:', err);
        setErrore('Impossibile caricare i dati storici.');
      })
      .finally(() => setLoading(false));
  }, [nome, tipo, stato]);

  // ── KPI sintetici ────────────────────────────────────────────────────
  const prezzoAttuale   = dati.at(-1)?.prezzo_medio_mq ?? 0;
  const prezzoIniziale  = dati[0]?.prezzo_medio_mq ?? 0;
  const variazionePerc  = prezzoIniziale > 0
    ? ((prezzoAttuale - prezzoIniziale) / prezzoIniziale) * 100
    : null;
  const locAttuale = dati.at(-1)?.locazione_media_mq ?? 0;
  const roiLordo   = prezzoAttuale > 0 && locAttuale > 0
    ? ((parseFloat(locAttuale) * 12) / prezzoAttuale) * 100
    : null;

  if (!nome || !tipo) return (
    <EmptyState icon="⚠️" title="Parametri mancanti"
      message="Naviga da Statistiche Quartiere → clicca su una tipologia." />
  );

  if (loading) return <LoadingSpinner text={`Caricamento storico ${tipo}…`} />;

  if (errore) return (
    <div className="flex items-center justify-center h-64 text-center">
      <div>
        <p className="mb-4 text-sm" style={{ color: 'var(--danger)' }}>⚠ {errore}</p>
        <button onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#000' }}>
          Torna indietro
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">

      {/* ── Breadcrumb + Back ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <button onClick={() => navigate('/')} className="hover:underline" style={{ color: 'var(--text-muted)' }}>
            Dashboard
          </button>
          <span>›</span>
          <button
            onClick={() => navigate(`/statistiche?nome=${encodeURIComponent(nome)}`)}
            className="hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            {nome}
          </button>
          <span>›</span>
          <span style={{ color: 'var(--accent)' }}>{tipo}</span>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          ← Torna alle Statistiche
        </button>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {tipo}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Quartiere <span style={{ color: 'var(--accent)' }}>{nome}</span>
          {' · '}Stato <strong>{stato}</strong>
          {' · '}Andamento storico OMI 2020–2025
        </p>
      </div>

      {/* ── Banner NTN non caricato ─────────────────────────────────── */}
      {Object.keys(ntn).length === 0 && (
        <div
          className="flex items-start gap-3 rounded-xl p-4 cursor-pointer"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}
          onClick={() => window.location.href = '/import'}
        >
          <span className="text-lg shrink-0 mt-0.5">📊</span>
          <div className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--accent)' }}>Dati transazioni non caricati</strong>
            <br />
            La colonna mostra i campioni OMI invece delle transazioni reali.
            Per vedere <em>quante compravendite avvengono ogni anno</em> in questo quartiere,
            importa il <strong>file NTN</strong> dall'Agenzia delle Entrate
            (Portale → Statistiche → Mercato Immobiliare → Download NTN per Comune).
            <span className="ml-2 font-medium" style={{ color: 'var(--accent)' }}>
              → Vai a Import Dati
            </span>
          </div>
        </div>
      )}

      {/* ── Info banner: cosa sono i dati OMI ────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-xl p-4"
        style={{
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.25)',
        }}
      >
        <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--info)' }}>Cosa sono le "Rilevazioni OMI"?</strong>
          <br />
          I dati provengono dall'<strong>Osservatorio del Mercato Immobiliare</strong> dell'Agenzia delle Entrate.
          L'OMI pubblica semestralmente delle <em>fasce di prezzo per tipologia e zona</em> — non il numero
          effettivo di transazioni. Ogni "rilevazione" è un campione statistico di prezzo rilevato in quella zona.
          Più rilevazioni = dato più solido e basato su più sottozone.
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Prezzo Attuale"
          value={formatEuro(prezzoAttuale)}
          subtitle={`Anno ${dati.at(-1)?.anno ?? '–'} · €/mq`}
        />
        <StatCard
          title="Variazione Storica"
          value={variazionePerc !== null
            ? `${variazionePerc > 0 ? '+' : ''}${variazionePerc.toFixed(1)}%`
            : '–'}
          positive={variazionePerc > 0}
          subtitle={`Dal ${dati[0]?.anno ?? '–'} al ${dati.at(-1)?.anno ?? '–'}`}
        />
        <StatCard
          title="ROI Lordo Stimato"
          value={roiLordo ? `${roiLordo.toFixed(1)}%` : '–'}
          positive={roiLordo > 5}
          subtitle="Rendimento annuo lordo"
        />
        <StatCard
          title="Anni di Storico"
          value={dati.length}
          subtitle="Anni di rilevazione disponibili"
        />
      </div>

      {dati.length === 0 ? (
        <EmptyState icon="📊" title="Nessun dato disponibile"
          message="Non ci sono dati storici per questa tipologia in questo quartiere." />
      ) : (
        <>
          {/* ── Grafico AreaChart ──────────────────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Andamento Prezzi · {tipo}
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-lg"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                Compravendita + Locazione
              </span>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dati} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gCompra" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gLoc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="anno"
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`}
                />
                <Tooltip content={<TooltipDettaglio />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }} />
                <Area
                  type="monotone"
                  dataKey="prezzo_medio_mq"
                  name="Compravendita €/mq"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#gCompra)"
                  dot={{ fill: '#f59e0b', r: 5, strokeWidth: 0 }}
                  activeDot={{ r: 7 }}
                />
                <Area
                  type="monotone"
                  dataKey="locazione_media_mq"
                  name="Locazione €/mq/mese"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gLoc)"
                  dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Tabella storica anno per anno ──────────────────────────── */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* Header tabella */}
            <div
              className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Andamento anno per anno · {tipo}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {nome} · Stato: {stato} · prezzi medi OMI in €/mq
                </p>
              </div>
              {/* Legenda colonna immobili venduti */}
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {Object.keys(ntn).length > 0
                  ? <span style={{ color: 'var(--success)' }}>✓ Dati NTN disponibili</span>
                  : <span>Immobili venduti: <span style={{ color: 'var(--warning)' }}>carica NTN per i dati</span></span>
                }
              </div>
            </div>

            {/* Nota prezzi stabili */}
            {dati.length > 1 && dati.slice(0, -1).some((r, i) => r.prezzo_medio_mq === dati[i + 1].prezzo_medio_mq) && (
              <div
                className="px-6 py-2 text-xs flex items-center gap-2"
                style={{ background: 'rgba(100,116,139,0.06)', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  ℹ Prezzi identici su più anni = l'OMI non ha aggiornato il benchmark (mercato stabile in quel periodo)
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)' }}>
                    {[
                      { label: 'Anno',                        w: 'w-24' },
                      { label: 'Prezzo Medio Compravendita',  w: '' },
                      { label: 'Locazione Media',             w: '' },
                      { label: 'Var. anno prec.',             w: 'w-32' },
                    ].map(({ label, w }) => (
                      <th key={label}
                        className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${w}`}
                        style={{ color: 'var(--text-muted)' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dati.map((r, i) => {
                    const prev    = dati[i - 1];
                    const varAnno = prev?.prezzo_medio_mq > 0
                      ? ((r.prezzo_medio_mq - prev.prezzo_medio_mq) / prev.prezzo_medio_mq) * 100
                      : null;
                    const isUltimo = i === dati.length - 1;
                    const ntnAnno  = ntn[r.anno];

                    return (
                      <tr
                        key={r.anno}
                        style={{
                          background: isUltimo
                            ? 'rgba(245,158,11,0.05)'
                            : i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        {/* Anno + badge attuale */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg leading-none" style={{ color: 'var(--text-primary)' }}>
                              {r.anno}
                            </span>
                            {isUltimo && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' }}>
                                attuale
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Prezzo medio compravendita — metrica principale */}
                        <td className="px-6 py-4">
                          <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {formatEuro(r.prezzo_medio_mq)}
                          </span>
                          <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>/mq</span>
                          {/* Range min-max in piccolo sotto il valore principale */}
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {formatEuro(r.prezzo_min)} – {formatEuro(r.prezzo_max)}
                          </p>
                        </td>

                        {/* Locazione media */}
                        <td className="px-6 py-4">
                          <span className="text-base font-semibold" style={{ color: 'var(--info)' }}>
                            {r.locazione_media_mq > 0 ? `€ ${r.locazione_media_mq}` : '–'}
                          </span>
                          {r.locazione_media_mq > 0 && (
                            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>/mq/mese</span>
                          )}
                        </td>

                        {/* Variazione percentuale vs anno precedente */}
                        <td className="px-6 py-4">
                          {varAnno !== null ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-bold px-3 py-1 rounded-full"
                                style={{
                                  background: varAnno > 0 ? 'rgba(16,185,129,0.12)'
                                    : varAnno < 0 ? 'rgba(239,68,68,0.12)'
                                    : 'rgba(100,116,139,0.12)',
                                  color: varAnno > 0 ? 'var(--success)'
                                    : varAnno < 0 ? 'var(--danger)'
                                    : 'var(--text-muted)',
                                }}
                              >
                                {varAnno > 0 ? '▲' : varAnno < 0 ? '▼' : '='}{' '}
                                {varAnno === 0 ? 'Stabile' : `${Math.abs(varAnno).toFixed(1)}%`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
