/**
 * ImportDati - Hub per l'importazione dei dati OMI
 *
 * Due modalità di import:
 *   1. CSV Massivo: trascina/carica un file CSV con centinaia di record
 *   2. Inserimento Manuale: form per aggiungere un singolo record
 *
 * Mostra anche:
 *   - Statistiche del database attuale (quanti record, anni disponibili)
 *   - Log delle ultime importazioni con stato (success/error/partial)
 */

import { useState, useEffect, useRef } from 'react';
import { importCSV, insertManuale, getImportLog, getImportStats, importNTN, getNTNStats, importCartella, importOMISemestraleZone, importOMISemestraleValori } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const STATI_IMMOBILE = ['NORMALE', 'OTTIMO', 'SCADENTE'];

/** Badge colorato per lo stato di un import */
function StatoBadge({ stato }) {
  const cfg = {
    success: { bg: 'rgba(16,185,129,0.15)', color: 'var(--success)', label: 'Completato' },
    partial: { bg: 'rgba(245,158,11,0.15)', color: 'var(--warning)', label: 'Parziale' },
    error:   { bg: 'rgba(239,68,68,0.15)',  color: 'var(--danger)',  label: 'Errore' },
    processing: { bg: 'rgba(59,130,246,0.15)', color: 'var(--info)', label: 'In corso' },
  };
  const s = cfg[stato] ?? cfg.processing;
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/** Report dettagliato del risultato di un import OMI semestrale */
function RisultatoOMI({ risultato, label }) {
  if (risultato.errore) {
    return (
      <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
        <p style={{ color: 'var(--danger)' }}>⚠ {risultato.errore}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
      <p className="font-semibold mb-2" style={{ color: '#a78bfa' }}>
        ✓ {label} importati — {risultato.anno_rilevato} S{risultato.semestre_rilevato}
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Nuovi: <strong style={{ color: 'var(--text-primary)' }}>{risultato.importate}</strong></span>
        <span>Aggiornati: <strong style={{ color: 'var(--text-primary)' }}>{risultato.aggiornate}</strong></span>
        <span>Prov. errata (scartate): {risultato.saltate_provincia_errata}</span>
        <span>Vuote/invalide: {risultato.saltate_vuote}</span>
      </div>
      {risultato.saltate_provincia_errata > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'rgba(245,158,11,0.9)' }}>
          ⚠ {risultato.saltate_provincia_errata} righe scartate perché non appartengono alla provincia CA
        </p>
      )}
      {risultato.errori_campione?.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>
            Errori ({risultato.errori_campione.length})
          </summary>
          <ul className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
            {risultato.errori_campione.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function ImportDati() {
  // Stato globale pagina
  const [stats, setStats]   = useState(null);
  const [logs, setLogs]     = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Stato CSV upload
  const [fileScelto, setFileScelto]       = useState(null);
  const [dragOver, setDragOver]           = useState(false);
  const [importando, setImportando]       = useState(false);
  const [risultatoCSV, setRisultatoCSV]   = useState(null);
  const inputFileRef = useRef(null);

  // Stato sezione NTN
  const [fileNTN, setFileNTN]         = useState(null);
  const [importandoNTN, setImportandoNTN] = useState(false);
  const [risultatoNTN, setRisultatoNTN]   = useState(null);
  const [statsNTN, setStatsNTN]           = useState(null);
  const [dragOverNTN, setDragOverNTN]     = useState(false);
  const inputNTNRef = useRef(null);

  // Stato import cartella hinterland
  const [importandoCartella, setImportandoCartella] = useState(false);
  const [risultatoCartella, setRisultatoCartella]   = useState(null);

  // Stato import OMI semestrale (ZONE.csv + VALORI.csv ufficiali)
  const [fileOMIZone,       setFileOMIZone]       = useState(null);
  const [fileOMIValori,     setFileOMIValori]      = useState(null);
  const [dragOverOMIZone,   setDragOverOMIZone]    = useState(false);
  const [dragOverOMIValori, setDragOverOMIValori]  = useState(false);
  const [importandoOMIZone,   setImportandoOMIZone]   = useState(false);
  const [importandoOMIValori, setImportandoOMIValori] = useState(false);
  const [risultatoOMIZone,    setRisultatoOMIZone]    = useState(null);
  const [risultatoOMIValori,  setRisultatoOMIValori]  = useState(null);
  const inputOMIZoneRef   = useRef(null);
  const inputOMIValoriRef = useRef(null);

  // Stato form manuale
  const [formManuale, setFormManuale] = useState({
    zona_codice: '', descrizione_tipologia: '', stato: 'NORMALE',
    anno: new Date().getFullYear(), semestre: 2,
    compravendita_min: '', compravendita_max: '',
    locazione_min: '', locazione_max: '',
  });
  const [salvandoManuale, setSalvandoManuale] = useState(false);
  const [messaggioManuale, setMessaggioManuale] = useState(null);

  // ── Caricamento statistiche e log ────────────────────────────────────
  const caricaDati = () => {
    console.log('[IMPORT] Caricamento stats, log e NTN stats');
    Promise.all([getImportStats(), getImportLog(), getNTNStats()])
      .then(([s, l, ntn]) => { setStats(s); setLogs(l); setStatsNTN(ntn); })
      .catch(err => console.error('[IMPORT] Errore caricamento:', err))
      .finally(() => setLoadingStats(false));
  };
  useEffect(caricaDati, []);

  // ── Import cartella hinterland ───────────────────────────────────────
  const avviaImportCartella = async () => {
    setImportandoCartella(true);
    setRisultatoCartella(null);
    console.log('[IMPORT] Avvio import cartella DATI_HINTERLAND');
    try {
      const result = await importCartella();
      setRisultatoCartella(result);
      caricaDati();
    } catch (err) {
      setRisultatoCartella({ errore: err.response?.data?.error ?? 'Errore durante l\'import della cartella' });
    } finally {
      setImportandoCartella(false);
    }
  };

  // ── Upload e import NTN CSV ──────────────────────────────────────────
  const avviaImportNTN = async () => {
    if (!fileNTN) return;
    setImportandoNTN(true);
    setRisultatoNTN(null);
    console.log(`[IMPORT NTN] Avvio: ${fileNTN.name}`);
    try {
      const result = await importNTN(fileNTN);
      setRisultatoNTN(result);
      caricaDati();
    } catch (err) {
      setRisultatoNTN({ errore: err.response?.data?.error ?? 'Errore durante l\'upload NTN' });
    } finally {
      setImportandoNTN(false);
    }
  };

  // ── Gestione drag & drop ──────────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setFileScelto(file); setRisultatoCSV(null); }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setFileScelto(file); setRisultatoCSV(null); }
  };

  // ── Upload e import CSV ───────────────────────────────────────────────
  const avviaImport = async () => {
    if (!fileScelto) return;
    setImportando(true);
    setRisultatoCSV(null);
    console.log(`[IMPORT] Avvio import CSV: ${fileScelto.name}`);

    try {
      const result = await importCSV(fileScelto);
      console.log('[IMPORT] Risultato:', result);
      setRisultatoCSV(result);
      caricaDati();  // Aggiorna stats e log
    } catch (err) {
      console.error('[IMPORT] Errore upload:', err);
      setRisultatoCSV({ errore: err.response?.data?.error ?? 'Errore durante l\'upload' });
    } finally {
      setImportando(false);
    }
  };

  // ── Salvataggio form manuale ──────────────────────────────────────────
  const salvaManuale = async (e) => {
    e.preventDefault();
    setSalvandoManuale(true);
    setMessaggioManuale(null);
    console.log('[IMPORT] Inserimento manuale:', formManuale);

    try {
      await insertManuale(formManuale);
      setMessaggioManuale({ tipo: 'success', testo: 'Record inserito con successo!' });
      setFormManuale(prev => ({ ...prev, compravendita_min: '', compravendita_max: '', locazione_min: '', locazione_max: '' }));
      caricaDati();
    } catch (err) {
      setMessaggioManuale({ tipo: 'error', testo: err.response?.data?.error ?? 'Errore inserimento' });
    } finally {
      setSalvandoManuale(false);
    }
  };

  // ── Import OMI Zone (ufficiale) ──────────────────────────────────────
  const avviaImportOMIZone = async () => {
    if (!fileOMIZone) return;
    setImportandoOMIZone(true);
    setRisultatoOMIZone(null);
    console.log(`[IMPORT OMI] Zone: ${fileOMIZone.name}`);
    try {
      const result = await importOMISemestraleZone(fileOMIZone);
      setRisultatoOMIZone(result);
      caricaDati();
    } catch (err) {
      setRisultatoOMIZone({ errore: err.response?.data?.error ?? 'Errore durante il caricamento delle zone' });
    } finally {
      setImportandoOMIZone(false);
    }
  };

  // ── Import OMI Valori (ufficiale) ─────────────────────────────────────
  const avviaImportOMIValori = async () => {
    if (!fileOMIValori) return;
    setImportandoOMIValori(true);
    setRisultatoOMIValori(null);
    console.log(`[IMPORT OMI] Valori: ${fileOMIValori.name}`);
    try {
      const result = await importOMISemestraleValori(fileOMIValori);
      setRisultatoOMIValori(result);
      caricaDati();
    } catch (err) {
      setRisultatoOMIValori({ errore: err.response?.data?.error ?? 'Errore durante il caricamento dei valori' });
    } finally {
      setImportandoOMIValori(false);
    }
  };

  const formatData = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col gap-8" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* ── Intestazione ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Import Dati Hub</h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
          Importa dati OMI tramite CSV massivo o inserimento manuale
        </p>
      </div>

      {/* ── Stats database ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingStats ? <LoadingSpinner /> : stats && (
          <>
            <div className="rounded-xl" style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.07em' }}>Totale Valori OMI</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                {Number(stats.totale_valori).toLocaleString('it-IT')}
              </p>
            </div>
            <div className="rounded-xl" style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.07em' }}>Zone Mappate</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.totale_zone}
              </p>
            </div>
            <div className="rounded-xl" style={{ padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.07em' }}>Annate Disponibili</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {stats.anni_disponibili?.join(', ') || '–'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEZIONE AGGIORNAMENTO SEMESTRALE OMI (ogni 6 mesi — Giugno/Dicembre)
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--bg-card)', border: '2px solid rgba(167,139,250,0.35)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">🔄</span>
              Aggiornamento Semestrale OMI
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Carica i file ufficiali <strong style={{ color: 'var(--text-primary)' }}>ZONE.csv</strong> e{' '}
              <strong style={{ color: 'var(--text-primary)' }}>VALORI.csv</strong> pubblicati
              dall'Agenzia delle Entrate ogni 6 mesi. Anno e semestre vengono rilevati automaticamente.
              I dati di province diverse da <strong style={{ color: '#a78bfa' }}>CA</strong> vengono
              scartati con report dettagliato.
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
          >
            Prossimo: Giugno 2026
          </div>
        </div>

        {/* Info box: come scaricarlo */}
        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}
        >
          <p className="font-semibold mb-2" style={{ color: '#a78bfa' }}>Come ottenere i file</p>
          <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li>Vai su <strong style={{ color: 'var(--text-primary)' }}>agenziaentrate.gov.it</strong></li>
            <li>Sezione: <strong>Servizi → OMI → Banche dati → Quotazioni immobiliari</strong></li>
            <li>Filtra per <strong>Provincia = CA</strong> e scarica l'ultimo semestre disponibile</li>
            <li>Troverai due file: <code style={{ color: '#a78bfa' }}>ZONE.csv</code> (definizioni) e <code style={{ color: '#a78bfa' }}>VALORI.csv</code> (prezzi)</li>
            <li>Carica prima ZONE.csv, poi VALORI.csv — l'ordine garantisce la corrispondenza zone→valori</li>
          </ol>
          <p className="mt-2 text-xs" style={{ color: 'rgba(167,139,250,0.7)' }}>
            Il sistema accetta solo dati Prov=CA. Le righe di altre province vengono contate e scartate automaticamente senza bloccare l'import.
          </p>
        </div>

        {/* Due drop zone affiancate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Drop zone ZONE.csv ── */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a78bfa' }}>
              1. ZONE.csv — Definizioni zone
            </p>

            <div
              className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer text-center border-2 border-dashed"
              style={{
                borderColor: dragOverOMIZone ? '#a78bfa' : 'var(--border)',
                background: dragOverOMIZone ? 'rgba(167,139,250,0.08)' : 'var(--bg-secondary)',
              }}
              onDragOver={e => { e.preventDefault(); setDragOverOMIZone(true); }}
              onDragLeave={() => setDragOverOMIZone(false)}
              onDrop={e => {
                e.preventDefault(); setDragOverOMIZone(false);
                const f = e.dataTransfer.files[0];
                if (f) { setFileOMIZone(f); setRisultatoOMIZone(null); }
              }}
              onClick={() => inputOMIZoneRef.current?.click()}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#a78bfa' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {fileOMIZone ? (
                <div>
                  <p className="font-medium text-sm" style={{ color: '#a78bfa' }}>{fileOMIZone.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {(fileOMIZone.size / 1024).toFixed(1)} KB · clicca per cambiare
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Trascina ZONE.csv qui o clicca
                </p>
              )}
              <input ref={inputOMIZoneRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) { setFileOMIZone(f); setRisultatoOMIZone(null); } }} />
            </div>

            <button
              onClick={avviaImportOMIZone}
              disabled={!fileOMIZone || importandoOMIZone}
              className="py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
              style={{ background: 'rgba(167,139,250,0.9)', color: '#fff' }}
            >
              {importandoOMIZone ? 'Importazione zone…' : 'Importa ZONE.csv'}
            </button>

            {/* Risultato ZONE */}
            {risultatoOMIZone && (
              <RisultatoOMI risultato={risultatoOMIZone} label="Zone" />
            )}
          </div>

          {/* ── Drop zone VALORI.csv ── */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a78bfa' }}>
              2. VALORI.csv — Prezzi di mercato
            </p>

            <div
              className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer text-center border-2 border-dashed"
              style={{
                borderColor: dragOverOMIValori ? '#a78bfa' : 'var(--border)',
                background: dragOverOMIValori ? 'rgba(167,139,250,0.08)' : 'var(--bg-secondary)',
              }}
              onDragOver={e => { e.preventDefault(); setDragOverOMIValori(true); }}
              onDragLeave={() => setDragOverOMIValori(false)}
              onDrop={e => {
                e.preventDefault(); setDragOverOMIValori(false);
                const f = e.dataTransfer.files[0];
                if (f) { setFileOMIValori(f); setRisultatoOMIValori(null); }
              }}
              onClick={() => inputOMIValoriRef.current?.click()}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#a78bfa' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {fileOMIValori ? (
                <div>
                  <p className="font-medium text-sm" style={{ color: '#a78bfa' }}>{fileOMIValori.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {(fileOMIValori.size / 1024).toFixed(1)} KB · clicca per cambiare
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Trascina VALORI.csv qui o clicca
                </p>
              )}
              <input ref={inputOMIValoriRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) { setFileOMIValori(f); setRisultatoOMIValori(null); } }} />
            </div>

            <button
              onClick={avviaImportOMIValori}
              disabled={!fileOMIValori || importandoOMIValori}
              className="py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
              style={{ background: 'rgba(167,139,250,0.9)', color: '#fff' }}
            >
              {importandoOMIValori ? 'Importazione valori…' : 'Importa VALORI.csv'}
            </button>

            {/* Risultato VALORI */}
            {risultatoOMIValori && (
              <RisultatoOMI risultato={risultatoOMIValori} label="Valori" />
            )}
          </div>
        </div>
      </div>

      {/* ── Layout 2 colonne: CSV + Manuale ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Sezione CSV ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)', fontSize: 16 }}>
            <span className="text-lg">📥</span> Import CSV Massivo
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Carica un file CSV con dati OMI. Formato atteso: separatore <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-hover)' }}>;</code>
          </p>

          {/* Zona drag & drop */}
          <div
            className={`
              rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer
              transition-colors duration-150 text-center
              ${dragOver ? 'border-2 border-dashed' : 'border-2 border-dashed'}
            `}
            style={{
              borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
              background: dragOver ? 'rgba(245,158,11,0.05)' : 'var(--bg-card)',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputFileRef.current?.click()}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            {fileScelto ? (
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--accent)' }}>{fileScelto.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {(fileScelto.size / 1024).toFixed(1)} KB · Clicca per cambiare file
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Trascina il tuo file CSV qui</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>oppure clicca per sfogliare · Max 50 MB</p>
              </div>
            )}

            {/* Input file nascosto (il click viene triggerato dalla div sopra) */}
            <input
              ref={inputFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {/* Risultato import */}
          {risultatoCSV && (
            <div
              className="rounded-lg p-4 text-sm"
              style={{
                background: risultatoCSV.errore ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                border: `1px solid ${risultatoCSV.errore ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              }}
            >
              {risultatoCSV.errore ? (
                <p style={{ color: 'var(--danger)' }}>⚠ {risultatoCSV.errore}</p>
              ) : (
                <>
                  <p style={{ color: 'var(--success)' }}>✓ Import completato</p>
                  <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    {risultatoCSV.righe_importate} importate · {risultatoCSV.righe_errore} errori
                    {' '}su {risultatoCSV.righe_totali} righe totali
                  </p>
                  {risultatoCSV.errori_campione?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>
                        Mostra errori ({risultatoCSV.errori_campione.length})
                      </summary>
                      <ul className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                        {risultatoCSV.errori_campione.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          <button
            onClick={avviaImport}
            disabled={!fileScelto || importando}
            className="py-2.5 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {importando ? 'Importazione in corso...' : 'Avvia Import'}
          </button>
        </div>

        {/* ── Sezione Manuale ─────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)', fontSize: 16 }}>
            <span className="text-lg">✏️</span> Inserimento Manuale
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Aggiungi un singolo record di valore OMI per zona/tipologia/periodo.
          </p>

          <form onSubmit={salvaManuale} className="flex flex-col gap-4">
            {/* Zona codice + tipologia */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Codice Zona*</label>
                <input
                  required
                  value={formManuale.zona_codice}
                  onChange={e => setFormManuale(p => ({ ...p, zona_codice: e.target.value }))}
                  placeholder="es. D12"
                  className="w-full rounded-lg text-sm"
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Anno*</label>
                <input
                  required
                  type="number"
                  value={formManuale.anno}
                  onChange={e => setFormManuale(p => ({ ...p, anno: e.target.value }))}
                  className="w-full rounded-lg text-sm"
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Tipologia*</label>
              <input
                required
                value={formManuale.descrizione_tipologia}
                onChange={e => setFormManuale(p => ({ ...p, descrizione_tipologia: e.target.value }))}
                placeholder="es. Abitazioni civili"
                className="w-full rounded-lg text-sm"
                style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Stato*</label>
                <select
                  value={formManuale.stato}
                  onChange={e => setFormManuale(p => ({ ...p, stato: e.target.value }))}
                  className="w-full rounded-lg text-sm"
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {STATI_IMMOBILE.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Semestre*</label>
                <select
                  value={formManuale.semestre}
                  onChange={e => setFormManuale(p => ({ ...p, semestre: e.target.value }))}
                  className="w-full rounded-lg text-sm"
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value={1}>1° Semestre</option>
                  <option value={2}>2° Semestre</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Compravendita Min (€/mq)*</label>
                <input
                  required type="number" step="0.01"
                  value={formManuale.compravendita_min}
                  onChange={e => setFormManuale(p => ({ ...p, compravendita_min: e.target.value }))}
                  placeholder="es. 1500"
                  className="w-full rounded-lg text-sm"
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-muted)' }}>Compravendita Max (€/mq)*</label>
                <input
                  required type="number" step="0.01"
                  value={formManuale.compravendita_max}
                  onChange={e => setFormManuale(p => ({ ...p, compravendita_max: e.target.value }))}
                  placeholder="es. 2000"
                  className="w-full rounded-lg text-sm"
                  style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {messaggioManuale && (
              <div
                className="rounded-lg text-sm"
                style={{
                  padding: '12px 16px',
                  background: messaggioManuale.tipo === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: messaggioManuale.tipo === 'success' ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {messaggioManuale.testo}
              </div>
            )}

            <button
              type="submit"
              disabled={salvandoManuale}
              className="rounded-lg font-semibold text-sm disabled:opacity-40"
              style={{ padding: '12px 20px', background: 'var(--accent)', color: '#000' }}
            >
              {salvandoManuale ? 'Salvataggio...' : 'Salva Record'}
            </button>
          </form>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEZIONE NTN — Numero Transazioni Normalizzate
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header + stato NTN */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">📈</span>
              Import NTN — Volumi Transazioni di Mercato
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Quante compravendite avvengono ogni anno per quartiere e tipologia
            </p>
          </div>
          {statsNTN && (
            <div
              className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              {statsNTN.totale_ntn > 0 ? (
                <>
                  <span style={{ color: 'var(--success)' }}>✓</span>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {Number(statsNTN.totale_ntn).toLocaleString('it-IT')} record NTN
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Anni: {statsNTN.anni_disponibili?.join(', ') || '–'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--warning)' }}>⚠</span>
                  <span style={{ color: 'var(--text-muted)' }}>Nessun dato NTN caricato</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Spiegazione */}
        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <p className="font-semibold mb-2" style={{ color: 'var(--info)' }}>
            Cos'è l'NTN e come scaricarlo
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            Il <strong style={{ color: 'var(--text-primary)' }}>Numero di Transazioni Normalizzate (NTN)</strong> è
            pubblicato dall'Agenzia delle Entrate e mostra quante compravendite e locazioni avvengono
            ogni anno per zona e tipologia immobiliare. Diversamente dai prezzi OMI (che sono stime di mercato),
            l'NTN si basa sugli atti notarili registrati.
          </p>
          <p className="mt-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            Come scaricarlo:
          </p>
          <ol className="mt-1 list-decimal list-inside space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li>Vai su <strong>agenziaentrate.gov.it</strong></li>
            <li>Sezione: <strong>Statistiche e analisi → Statistiche del mercato immobiliare</strong></li>
            <li>Cerca "NTN" o "Numero transazioni" → scarica il CSV per provincia di <strong>Cagliari</strong></li>
            <li>Carica il file qui sotto (supportati separatori <code className="px-1 rounded" style={{ background: 'var(--bg-hover)' }}>;</code> e <code className="px-1 rounded" style={{ background: 'var(--bg-hover)' }}>,</code>)</li>
          </ol>
        </div>

        {/* Drop zone NTN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-3">
            <div
              className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer text-center border-2 border-dashed"
              style={{
                borderColor: dragOverNTN ? 'var(--accent)' : 'var(--border)',
                background: dragOverNTN ? 'rgba(245,158,11,0.05)' : 'var(--bg-secondary)',
              }}
              onDragOver={e => { e.preventDefault(); setDragOverNTN(true); }}
              onDragLeave={() => setDragOverNTN(false)}
              onDrop={e => { e.preventDefault(); setDragOverNTN(false); const f = e.dataTransfer.files[0]; if (f) { setFileNTN(f); setRisultatoNTN(null); } }}
              onClick={() => inputNTNRef.current?.click()}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {fileNTN ? (
                <p className="font-medium text-sm" style={{ color: 'var(--accent)' }}>{fileNTN.name}</p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Trascina il CSV NTN qui o clicca
                </p>
              )}
              <input ref={inputNTNRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) { setFileNTN(f); setRisultatoNTN(null); } }} />
            </div>

            <button
              onClick={avviaImportNTN}
              disabled={!fileNTN || importandoNTN}
              className="py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40"
              style={{ background: 'var(--info)', color: '#fff' }}
            >
              {importandoNTN ? 'Importazione NTN in corso…' : 'Importa NTN'}
            </button>
          </div>

          {/* Risultato + formato atteso */}
          <div className="flex flex-col gap-3">
            {risultatoNTN && (
              <div
                className="rounded-xl p-4 text-sm"
                style={{
                  background: risultatoNTN.errore ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${risultatoNTN.errore ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}
              >
                {risultatoNTN.errore ? (
                  <p style={{ color: 'var(--danger)' }}>⚠ {risultatoNTN.errore}</p>
                ) : (
                  <>
                    <p style={{ color: 'var(--success)' }}>✓ Import NTN completato</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {risultatoNTN.righe_importate} importate · {risultatoNTN.righe_errore} errori su {risultatoNTN.righe_totali} righe
                    </p>
                  </>
                )}
              </div>
            )}

            <div
              className="rounded-xl p-4 text-xs"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Colonne CSV attese (gestisce varianti nomi)
              </p>
              <div className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                {[
                  ['link_zona / zona_codice', 'Codice zona OMI', true],
                  ['descrizione_tipologia / tipologia', 'Tipo immobile', true],
                  ['anno', 'Anno (es. 2024)', true],
                  ['semestre', '1 o 2', true],
                  ['ntn_compravendita / ntn', 'N° transazioni acquisto', false],
                  ['ntn_locazione / ntn_loc', 'N° transazioni locazione', false],
                ].map(([campo, desc, req]) => (
                  <div key={campo} className="flex items-start gap-2">
                    <span
                      className="shrink-0 px-1 rounded text-xs font-mono"
                      style={{
                        background: req ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                        color: req ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {req ? '*' : '◦'}
                    </span>
                    <code style={{ color: 'var(--text-primary)' }}>{campo}</code>
                    <span>— {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEZIONE HINTERLAND — Import bulk dalla cartella server
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className="rounded-xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span className="text-xl">🗺️</span>
              Import Provincia di Cagliari (Hinterland)
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Importa automaticamente tutti i semestri dalla cartella <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-hover)' }}>DATI_HINTERLAND</code> sul server.
              Le zone e i valori già presenti vengono saltati — nessun duplicato.
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          <p className="font-semibold mb-1" style={{ color: 'var(--success)' }}>Come funziona</p>
          <ul className="space-y-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
            <li>Legge tutte le sottocartelle <code style={{ color: 'var(--text-primary)' }}>YYYY_SS_PROV</code> (es. 2024_01_PROV)</li>
            <li>Per ogni semestre importa <code style={{ color: 'var(--text-primary)' }}>ZONE.csv</code> e <code style={{ color: 'var(--text-primary)' }}>VALORI.csv</code></li>
            <li>Le zone già presenti (per codice univoco) vengono automaticamente saltate</li>
            <li>Comune di Cagliari e tutti gli altri comuni della provincia vengono distinti automaticamente</li>
          </ul>
        </div>

        <div className="flex items-start gap-6 flex-wrap">
          <button
            onClick={avviaImportCartella}
            disabled={importandoCartella}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--success)', color: '#fff' }}
          >
            {importandoCartella ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Importazione in corso...
              </>
            ) : (
              'Avvia Import Provincia'
            )}
          </button>

          {risultatoCartella && (
            <div
              className="flex-1 rounded-xl p-4 text-sm min-w-[260px]"
              style={{
                background: risultatoCartella.errore ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                border: `1px solid ${risultatoCartella.errore ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              }}
            >
              {risultatoCartella.errore ? (
                <p style={{ color: 'var(--danger)' }}>⚠ {risultatoCartella.errore}</p>
              ) : (
                <>
                  <p className="font-semibold" style={{ color: 'var(--success)' }}>
                    ✓ Import completato — {risultatoCartella.semestri_processati} semestri
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Zone nuove: <strong style={{ color: 'var(--text-primary)' }}>{risultatoCartella.zone_importate}</strong></span>
                    <span>Zone saltate: {risultatoCartella.zone_saltate}</span>
                    <span>Valori nuovi: <strong style={{ color: 'var(--text-primary)' }}>{risultatoCartella.valori_importati}</strong></span>
                    <span>Valori saltati: {risultatoCartella.valori_saltati}</span>
                  </div>
                  {risultatoCartella.errori_campione?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>
                        Errori ({risultatoCartella.errori_campione.length})
                      </summary>
                      <ul className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                        {risultatoCartella.errori_campione.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Log importazioni ─────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)', fontSize: 15 }}>
            Storico Importazioni
          </h2>
          <button onClick={caricaDati} className="text-xs font-medium" style={{ color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>Aggiorna</button>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Nessuna importazione effettuata</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['File / Tipo', 'Data', 'Righe', 'OK', 'Errori', 'Stato'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.id}
                    style={{
                      background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{log.filename}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{log.tipo}</p>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{formatData(log.data_import)}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{log.righe_totali}</td>
                    <td className="px-5 py-4 text-sm font-semibold" style={{ color: 'var(--success)' }}>{log.righe_importate}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: log.righe_errore > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{log.righe_errore}</td>
                    <td className="px-5 py-4"><StatoBadge stato={log.stato} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
