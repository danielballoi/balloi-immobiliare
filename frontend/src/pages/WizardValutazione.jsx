/**
 * WizardValutazione - Wizard a 5 step per la valutazione immobiliare
 *
 * Step 0 - Tipo Area:   Cagliari Comune o Hinterland/Provincia?
 * Step 1 - Dati Base:   indirizzo (autocomplete per Cagliari), zona, tipologia, mq, piano, dotazioni
 * Step 2 - Mercato:     calcola VCM (Valutazione Comparativa di Mercato)
 * Step 3 - Costi/Reddito: analisi finanziaria con mutuo e flussi di cassa
 * Step 4 - Risultati:   riepilogo completo, salva o aggiungi al portafoglio
 *
 * Il wizard mantiene tutti i dati in un unico stato "val".
 * Al completamento, la valutazione viene salvata in "Valutazioni Eseguite" (portafoglio).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getZone, getTipologie, calcolaVCM, calcolaReddituale,
  calcolaDCF, salvaValutazione, aggiungiAPortafoglio,
  getHeatmap,
} from '../services/api';
import StradeAutocomplete from '../components/StradeAutocomplete';
import LoadingSpinner from '../components/LoadingSpinner';

// ── Costanti ───────────────────────────────────────────────────────────────
const STATI_IMMOBILE = ['NORMALE', 'OTTIMO', 'SCADENTE'];
const PIANI = ['Piano terra', '1° piano', '2° piano', '3° piano', '4° piano', '5° piano o oltre'];
const STEPS = ['Tipo Area', 'Dati Immobile', 'Mercato', 'Costi & Reddito', 'Risultati'];

const formatEuro = (n) =>
  n != null && !isNaN(n) ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';
const formatPct = (n) =>
  n != null && !isNaN(n) ? `${Number(n).toFixed(1)}%` : '–';

/** Barra di avanzamento step — nessun margin bottom (lo gestisce il container) */
function StepBar({ step, steps }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              background: i < step ? 'var(--success)' : i === step ? 'var(--accent)' : 'var(--bg-hover)',
              color: i <= step ? '#000' : 'var(--text-muted)',
            }}
          >
            {i < step ? '✓' : i + 1}
          </div>
          <span className="text-xs hidden sm:block" style={{ color: i === step ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px" style={{ background: i < step ? 'var(--success)' : 'var(--border)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Riga KPI risultato */
function RigaKPI({ label, valore, highlight, colore }) {
  return (
    <div
      className={`flex justify-between items-center px-4 py-3 rounded-lg ${highlight ? 'border' : ''}`}
      style={{
        background: highlight ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
        borderColor: highlight ? 'rgba(245,158,11,0.3)' : 'transparent',
        marginBottom: 4,
      }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: colore ?? (highlight ? 'var(--accent)' : 'var(--text-primary)') }}>
        {valore}
      </span>
    </div>
  );
}

/**
 * InfoIcon - icona (i) cliccabile con popup spiegazione campo.
 * Chiude il popup cliccando fuori.
 */
function InfoIcon({ titolo, testo }) {
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

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        type="button"
        onClick={() => setAperto(v => !v)}
        className="ml-1.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold leading-none hover:opacity-80 transition-opacity"
        style={{ background: 'rgba(100,116,139,0.3)', color: 'var(--text-muted)' }}
        title="Informazioni sul campo"
      >
        i
      </button>

      {aperto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAperto(false)} />
          <div
            className="absolute z-50 bottom-full mb-2 left-0 rounded-xl p-4 shadow-2xl w-72 text-left"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--accent)' }}>{titolo}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{testo}</p>
          </div>
        </>
      )}
    </div>
  );
}

/** Label con icona info opzionale */
function Label({ children, info }) {
  return (
    <label className="flex items-center text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children}
      {info && <InfoIcon titolo={info.titolo} testo={info.testo} />}
    </label>
  );
}

export default function WizardValutazione() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const zonaParam = searchParams.get('zona') ?? '';

  const [stepAttivo, setStepAttivo] = useState(0);
  // 'CAGLIARI' o 'HINTERLAND' — scelto nello step 0
  const [areaWizard, setAreaWizard] = useState('CAGLIARI');

  const [zone, setZone]           = useState([]);
  const [tipologie, setTipologie] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [errore, setErrore]       = useState(null);
  const [salvato, setSalvato]     = useState(false);

  // ── Stato globale valutazione ─────────────────────────────────────────
  const [val, setVal] = useState({
    // Step 1 - Dati immobile
    indirizzo: '',
    zona_codice: zonaParam,
    tipologia: '',
    stato_immobile: 'NORMALE',
    superficie_mq: '',
    piano: 1,
    anno_costruzione: '',
    ascensore: false,
    box_auto: false,
    balcone_terrazza: false,
    cantina: false,

    // Step 2 - Parametri VCM
    prezzo_base_override: '',
    vcm: null,

    // Step 3 - Parametri Reddituale
    canone_mensile: '',
    vacancy_pct: 5,
    spese_annue: 0,
    cap_rate_pct: 5,
    reddituale: null,

    // Step 3b - Parametri DCF
    prezzo_acquisto: '',
    costi_acquisto_pct: 10,
    costi_ristrutturazione: 0,
    ltv_pct: 0,
    tasso_mutuo_pct: 3.5,
    durata_mutuo_anni: 20,
    orizzonte_anni: 5,
    tasso_attualizzazione_pct: 6,
    tasso_crescita_noi_pct: 2,
    cap_rate_exit_pct: 5,
    dcf: null,
  });

  const upd = (campo, valore) => setVal(prev => ({ ...prev, [campo]: valore }));

  // ── Caricamento zone e tipologie ────────────────────────────────────
  useEffect(() => {
    console.log('[WIZARD] Caricamento zone e tipologie');
    Promise.all([getZone(), getHeatmap(null, 'HINTERLAND'), getTipologie()])
      .then(([cagliariZone, hinterlandZone, t]) => {
        const tutte = [
          ...cagliariZone.map(z => ({ ...z, area: z.area || 'CAGLIARI' })),
          ...hinterlandZone.map(z => ({ ...z, area: 'HINTERLAND' })),
        ];
        setZone(tutte);
        setTipologie(t);
        console.log(`[WIZARD] ${tutte.length} zone totali, ${t.length} tipologie`);
      })
      .catch(err => console.error('[WIZARD] Errore caricamento supporto:', err));
  }, []);

  // ── Handler autocomplete strade (Cagliari) ──────────────────────────
  // Quando l'utente sceglie una via, popola indirizzo e trova la zona OMI
  function handleStradeSeleziona(item) {
    console.log('[WIZARD] Via selezionata:', item.via, '→ link_zona:', item.link_zona);
    upd('indirizzo', item.via);

    // Auto-fill zona_codice dal link_zona della via
    if (item.link_zona) {
      upd('zona_codice', item.link_zona);
      console.log('[WIZARD] Zona auto-completata:', item.link_zona);
    } else if (item.quartiere) {
      // Fallback: cerca corrispondenza per quartiere
      const zona = zone.find(z =>
        z.descrizione_zona?.replace(/^'+|'+$/g, '').toUpperCase() === item.quartiere.toUpperCase()
      );
      if (zona) {
        upd('zona_codice', zona.link_zona);
        console.log('[WIZARD] Zona trovata per quartiere:', zona.link_zona);
      }
    }
  }

  // ── Step 2: Calcolo VCM ──────────────────────────────────────────────
  const eseguiVCM = async () => {
    setLoading(true);
    setErrore(null);
    console.log('[WIZARD] Calcolo VCM per zona:', val.zona_codice, 'tipo:', val.tipologia);
    try {
      const risultato = await calcolaVCM({
        zona_codice:      val.zona_codice,
        tipologia:        val.tipologia,
        stato:            val.stato_immobile,
        superficie_mq:    parseFloat(val.superficie_mq),
        piano:            val.piano,
        ascensore:        val.ascensore,
        box_auto:         val.box_auto,
        balcone_terrazza: val.balcone_terrazza,
        cantina:          val.cantina,
        prezzo_base_override: val.prezzo_base_override ? parseFloat(val.prezzo_base_override) : null,
      });
      console.log('[WIZARD] VCM risultato:', risultato);
      upd('vcm', risultato);
      if (!val.prezzo_acquisto) upd('prezzo_acquisto', risultato.valore_medio);
      setStepAttivo(3);
    } catch (err) {
      console.error('[WIZARD] Errore VCM:', err);
      setErrore(err.response?.data?.error ?? 'Errore calcolo VCM');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Calcolo Reddituale + DCF ────────────────────────────────
  const eseguiAnalisiFinanziaria = async () => {
    setLoading(true);
    setErrore(null);
    console.log('[WIZARD] Avvio analisi finanziaria');
    try {
      const [red, dcf] = await Promise.all([
        val.canone_mensile ? calcolaReddituale({
          canone_mensile: parseFloat(val.canone_mensile),
          vacancy_pct:    parseFloat(val.vacancy_pct),
          spese_annue:    parseFloat(val.spese_annue),
          cap_rate_pct:   parseFloat(val.cap_rate_pct),
          superficie_mq:  parseFloat(val.superficie_mq),
        }) : Promise.resolve(null),

        (val.prezzo_acquisto && val.canone_mensile) ? calcolaDCF({
          prezzo_acquisto:            parseFloat(val.prezzo_acquisto),
          costi_acquisto_pct:         parseFloat(val.costi_acquisto_pct),
          costi_ristrutturazione:     parseFloat(val.costi_ristrutturazione || 0),
          ltv_pct:                    parseFloat(val.ltv_pct),
          tasso_mutuo_pct:            parseFloat(val.tasso_mutuo_pct),
          durata_mutuo_anni:          parseInt(val.durata_mutuo_anni),
          canone_mensile:             parseFloat(val.canone_mensile),
          vacancy_pct:                parseFloat(val.vacancy_pct),
          spese_operative_annue:      parseFloat(val.spese_annue || 0),
          tasso_crescita_noi_pct:     parseFloat(val.tasso_crescita_noi_pct),
          orizzonte_anni:             parseInt(val.orizzonte_anni),
          tasso_attualizzazione_pct:  parseFloat(val.tasso_attualizzazione_pct),
          cap_rate_exit_pct:          parseFloat(val.cap_rate_exit_pct),
        }) : Promise.resolve(null),
      ]);
      console.log('[WIZARD] Reddituale:', red, 'DCF:', dcf);
      setVal(prev => ({ ...prev, reddituale: red, dcf: dcf }));
      setStepAttivo(4);
    } catch (err) {
      console.error('[WIZARD] Errore analisi finanziaria:', err);
      setErrore(err.response?.data?.error ?? 'Errore analisi finanziaria');
    } finally {
      setLoading(false);
    }
  };

  // ── Salvataggio valutazione ──────────────────────────────────────────
  const salvaRisultati = async (aggiungiPortafoglio = false) => {
    setLoading(true);
    try {
      const payload = {
        indirizzo:        val.indirizzo,
        zona_codice:      val.zona_codice,
        tipologia:        val.tipologia,
        stato_immobile:   val.stato_immobile,
        superficie_mq:    val.superficie_mq,
        piano:            val.piano,
        anno_costruzione: val.anno_costruzione || null,
        ascensore:        val.ascensore,
        box_auto:         val.box_auto,
        balcone_terrazza: val.balcone_terrazza,
        cantina:          val.cantina,
        ...(val.vcm && {
          vcm_prezzo_base_mq:     val.vcm.prezzo_base_mq,
          vcm_valore_min:         val.vcm.valore_min,
          vcm_valore_medio:       val.vcm.valore_medio,
          vcm_valore_max:         val.vcm.valore_max,
          vcm_numero_comparabili: val.vcm.numero_comparabili,
        }),
        ...(val.reddituale && {
          red_canone_mensile_lordo: val.canone_mensile,
          red_noi_annuo:            val.reddituale.noi_annuo,
          red_spese_annue:          val.spese_annue,
          red_vacancy_pct:          val.vacancy_pct,
          red_cap_rate_pct:         val.cap_rate_pct,
          red_valore_mercato:       val.reddituale.valore_mercato,
          red_rendimento_lordo_pct: val.reddituale.rendimento_lordo_pct,
          red_rendimento_netto_pct: val.reddituale.rendimento_netto_pct,
        }),
        ...(val.dcf && {
          dcf_prezzo_acquisto:            val.prezzo_acquisto,
          dcf_costi_acquisto_pct:         val.costi_acquisto_pct,
          dcf_costi_ristrutturazione:     val.costi_ristrutturazione,
          dcf_capitale_investito:         val.dcf.equity,
          dcf_ltv_pct:                    val.ltv_pct,
          dcf_tasso_mutuo_pct:            val.tasso_mutuo_pct,
          dcf_durata_mutuo_anni:          val.durata_mutuo_anni,
          dcf_rata_mensile:               val.dcf.rata_mensile,
          dcf_orizzonte_anni:             val.orizzonte_anni,
          dcf_tasso_crescita_noi_pct:     val.tasso_crescita_noi_pct,
          dcf_tasso_attualizzazione_pct:  val.tasso_attualizzazione_pct,
          dcf_valore_rivendita_finale:    val.dcf.valore_rivendita_finale,
          dcf_van:                        val.dcf.van,
          dcf_tir_pct:                    val.dcf.tir_pct,
          dcf_roi_totale_pct:             val.dcf.roi_totale_pct,
          dcf_cash_on_cash_pct:           val.dcf.cash_on_cash_pct,
        }),
        metodologia_principale: val.dcf ? 'DCF' : val.reddituale ? 'Reddituale' : 'VCM',
        salvato_portafoglio: aggiungiPortafoglio ? 1 : 0,
      };

      const { valutazione_id } = await salvaValutazione(payload);
      console.log('[WIZARD] Valutazione salvata ID:', valutazione_id);

      if (aggiungiPortafoglio) {
        await aggiungiAPortafoglio({
          valutazione_id,
          indirizzo:       val.indirizzo,
          zona_codice:     val.zona_codice,
          tipologia:       val.tipologia,
          stato_immobile:  val.stato_immobile,
          superficie_mq:   val.superficie_mq,
          prezzo_acquisto: val.prezzo_acquisto,
          canone_mensile:  val.canone_mensile,
          vcm_valore_medio: val.vcm?.valore_medio,
          tir_pct:          val.dcf?.tir_pct,
          roi_totale_pct:   val.dcf?.roi_totale_pct,
          van:              val.dcf?.van,
        });
        navigate('/portafoglio');
      } else {
        setSalvato(true);
      }
    } catch (err) {
      console.error('[WIZARD] Errore salvataggio:', err);
      setErrore('Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  // ── Stile input condiviso — padding aumentato per altezza moderna (12/16px) ────
  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '12px 16px',
  };

  // ── Zona selezionata (nome leggibile) ────────────────────────────────
  const zonaNome = zone.find(z => z.link_zona === val.zona_codice)?.descrizione_zona
    ?.replace(/^'+|'+$/g, '').trim() ?? val.zona_codice;

  return (
    /* gap: 32px tra titolo e card — rispetta la regola: nulla deve toccarsi */
    <div style={{ maxWidth: 768, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Nuova Valutazione</h1>
        <p className="text-sm" style={{ marginTop: 6, color: 'var(--text-muted)' }}>Wizard guidato · {STEPS.length} passaggi</p>
      </div>

      {/* ── Card wizard: due zone visive distinte ─────────────────────────── */}
      <div className="rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>

        {/* ── ZONA 1: barra avanzamento — bordo inferiore la separa dal form ── */}
        <div style={{ padding: '24px 44px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <StepBar step={stepAttivo} steps={STEPS} />
        </div>

        {/* ── ZONA 2: contenuto form — padding pieno 40px su tutti i lati ── */}
        <div style={{ padding: '40px 44px' }}>

        {errore && (
          <div style={{ marginBottom: 28, padding: '12px 16px', borderRadius: 10, fontSize: 14, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠ {errore}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 0 - TIPO AREA                                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 0 && (
          <div className="flex flex-col gap-8 items-center text-center">
            {/* Titolo con spazio inferiore marcato per non attaccarsi al contenuto */}
            <div style={{ paddingBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
                Dove si trova l'immobile?
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Seleziona se la valutazione riguarda il Comune di Cagliari o la provincia (hinterland).
              </p>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-secondary)', alignSelf: 'center' }}>
              {[
                { value: 'CAGLIARI',   label: 'Cagliari Comune',      desc: "Indirizzo completato automaticamente dallo stradario." },
                { value: 'HINTERLAND', label: 'Hinterland / Provincia', desc: "Quartu, Selargius, Assemini, Capoterra e altri comuni." },
              ].map(opt => {
                const selezionato = areaWizard === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAreaWizard(opt.value)}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      transition: 'all 0.15s',
                      background: selezionato ? 'var(--accent)' : 'transparent',
                      color: selezionato ? '#000' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {areaWizard === 'CAGLIARI'
                ? "Immobile nel Comune di Cagliari. L'indirizzo verrà completato automaticamente dallo stradario."
                : "Immobile in un comune dell'hinterland (Quartu, Selargius, Assemini, Capoterra, ecc.)."
              }
            </p>

            {/* Bottone separato visivamente dal form con bordo e margine */}
            <div className="flex justify-end" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)', width: '100%' }}>
              <button
                onClick={() => setStepAttivo(1)}
                style={{ padding: '12px 32px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 1 - DATI BASE IMMOBILE                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 1 && (
          <div className="flex flex-col gap-7">
            <div style={{ paddingBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>Dati Base Immobile</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Inserisci le informazioni principali della proprietà per iniziare l'analisi.
                {areaWizard === 'CAGLIARI'
                  ? ' Cerca la via per auto-completare il quartiere.'
                  : ' Seleziona manualmente la zona.'}
              </p>
            </div>

            {/* Indirizzo + Zona */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label>Indirizzo Completo</Label>
                {areaWizard === 'CAGLIARI' ? (
                  /*
                   * CAGLIARI: autocomplete stradario → auto-fill zona_codice.
                   * L'utente sceglie la via e il quartiere si popola in automatico.
                   */
                  <StradeAutocomplete
                    onSeleziona={handleStradeSeleziona}
                    onSvuota={() => { upd('indirizzo', ''); upd('zona_codice', ''); }}
                    placeholder="Cerca via, viale, piazza…"
                    compact
                  />
                ) : (
                  <input
                    value={val.indirizzo}
                    onChange={e => upd('indirizzo', e.target.value)}
                    placeholder="Es. Via Roma, 12 – Quartu"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  />
                )}
              </div>
              <div>
                <Label>
                  {areaWizard === 'CAGLIARI' ? 'Quartiere (Cagliari)*' : 'Comune*'}
                </Label>
                {areaWizard === 'CAGLIARI' ? (
                  <>
                    <select
                      required
                      value={val.zona_codice}
                      onChange={e => upd('zona_codice', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={inputStyle}
                    >
                      <option value="">Seleziona quartiere...</option>
                      {zone
                        .filter(z => z.area === 'CAGLIARI' || !z.area)
                        .map(z => (
                          <option key={z.id ?? z.link_zona} value={z.link_zona}>
                            {z.descrizione_zona?.replace(/^'+|'+$/g, '').trim()}
                          </option>
                        ))}
                    </select>
                    {val.zona_codice && (
                      <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>
                        ✓ Quartiere: {zonaNome}
                      </p>
                    )}
                  </>
                ) : (
                  <select
                    required
                    value={val.zona_codice}
                    onChange={e => upd('zona_codice', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  >
                    <option value="">Seleziona comune...</option>
                    {[...new Map(
                      zone
                        .filter(z => z.area === 'HINTERLAND' && z.comune)
                        .map(z => [z.comune, z])
                    ).values()]
                      .sort((a, b) => (a.comune ?? '').localeCompare(b.comune ?? ''))
                      .map(z => (
                        <option key={z.link_zona} value={z.link_zona}>
                          {z.comune}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            {/* Tipologia + Superficie commerciale + Stato */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <Label>Tipologia*</Label>
                <select
                  required
                  value={val.tipologia}
                  onChange={e => upd('tipologia', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                >
                  <option value="">Seleziona...</option>
                  {tipologie.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                {/* RICHIESTO: "Superficie" → "Superficie commerciale (mq)" */}
                <Label>Superficie commerciale (mq)*</Label>
                <input
                  required
                  type="number" step="0.5" min="1"
                  value={val.superficie_mq}
                  onChange={e => upd('superficie_mq', e.target.value)}
                  placeholder="Es. 80"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>Stato Immobile*</Label>
                <select
                  value={val.stato_immobile}
                  onChange={e => upd('stato_immobile', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                >
                  {STATI_IMMOBILE.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Piano + Anno costruzione */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label>Piano</Label>
                <select
                  value={val.piano}
                  onChange={e => upd('piano', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                >
                  {PIANI.map((p, i) => <option key={i} value={i}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label>Anno di Costruzione</Label>
                <input
                  type="number" min="1900" max={new Date().getFullYear()}
                  value={val.anno_costruzione}
                  onChange={e => upd('anno_costruzione', e.target.value)}
                  placeholder="Es. 1980"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Dotazioni aggiuntive */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Caratteristiche Aggiuntive (Opzionale)</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'ascensore',        label: 'Ascensore' },
                  { key: 'balcone_terrazza', label: 'Balcone/Terrazza' },
                  { key: 'box_auto',         label: 'Box Auto' },
                  { key: 'cantina',          label: 'Cantina' },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors"
                    style={{
                      background: val[key] ? 'rgba(245,158,11,0.1)' : 'var(--bg-secondary)',
                      border: `1px solid ${val[key] ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                      color: val[key] ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={val[key]}
                      onChange={e => upd(key, e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Bottoni separati dal form con bordo e margine — gerarchia visiva chiara */}
            <div className="flex justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setStepAttivo(0)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                ← Indietro
              </button>
              <button
                onClick={() => setStepAttivo(2)}
                disabled={!val.zona_codice || !val.tipologia || !val.superficie_mq}
                className="disabled:opacity-40"
                style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 2 - VALUTAZIONE COMPARATIVA (VCM)                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 2 && (
          <div className="flex flex-col gap-7">
            <div style={{ paddingBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>Analisi di Mercato (VCM)</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Stima il valore basandosi sui prezzi OMI comparabili della zona.
              </p>
            </div>

            {/* Riepilogo dati immobile */}
            <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex flex-wrap gap-4">
                <span style={{ color: 'var(--text-muted)' }}>Zona: <strong style={{ color: 'var(--text-primary)' }}>{zonaNome}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Tipologia: <strong style={{ color: 'var(--text-primary)' }}>{val.tipologia}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Mq: <strong style={{ color: 'var(--text-primary)' }}>{val.superficie_mq} mq</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Stato: <strong style={{ color: 'var(--text-primary)' }}>{val.stato_immobile}</strong></span>
              </div>
            </div>

            <div>
              <Label>Prezzo base personalizzato €/mq (lascia vuoto per usare i dati OMI)</Label>
              <input
                type="number" step="10"
                value={val.prezzo_base_override}
                onChange={e => upd('prezzo_base_override', e.target.value)}
                placeholder="Es. 1800 (opzionale)"
                className="w-full max-w-xs px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>

            {val.vcm && (
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Risultato VCM</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Valore Min</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{formatEuro(val.vcm.valore_min)}</p>
                  </div>
                  <div className="border-x" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Valore Medio</p>
                    <p className="font-bold text-xl" style={{ color: 'var(--accent)' }}>{formatEuro(val.vcm.valore_medio)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Valore Max</p>
                    <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{formatEuro(val.vcm.valore_max)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Prezzo base: {formatEuro(val.vcm.prezzo_base_mq)}/mq · Coeff. piano: {val.vcm.coefficiente_piano} · {val.vcm.numero_comparabili} comparabili
                </p>
              </div>
            )}

            <div className="flex justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setStepAttivo(1)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                ← Indietro
              </button>
              <button
                onClick={eseguiVCM}
                disabled={loading}
                className="disabled:opacity-40"
                style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {loading ? 'Calcolo...' : val.vcm ? 'Ricalcola e Avanti →' : 'Calcola VCM →'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 3 - COSTI & REDDITO (DCF)                             */}
        {/* Ogni voce ha icona (i) cliccabile con spiegazione dettagliata */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 3 && (
          <div className="flex flex-col gap-7">
            <div style={{ paddingBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>Costi & Analisi Reddituale</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Inserisci i dati finanziari. Ogni campo ha un'icona ⓘ con la spiegazione.
              </p>
            </div>

            {/* Prezzo acquisto + canone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label info={{
                  titolo: 'Prezzo di Acquisto',
                  testo: 'Il prezzo a cui intendi acquistare l\'immobile in €. Se hai già fatto la VCM, viene pre-compilato con il valore medio di mercato. Serve come base per calcolare il rendimento sul capitale investito.',
                }}>
                  Prezzo Acquisto (€)
                </Label>
                <input
                  type="number"
                  value={val.prezzo_acquisto}
                  onChange={e => upd('prezzo_acquisto', e.target.value)}
                  placeholder={val.vcm ? `Es. ${val.vcm.valore_medio}` : 'Es. 200000'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label info={{
                  titolo: 'Canone Mensile Lordo',
                  testo: 'L\'affitto mensile lordo che pensi di incassare in €. È il canone prima di togliere le spese (condominio, gestione, ecc.) e i periodi di sfitto. Usato per calcolare il ROI e la redditività.',
                }}>
                  Canone Mensile Lordo (€)
                </Label>
                <input
                  type="number"
                  value={val.canone_mensile}
                  onChange={e => upd('canone_mensile', e.target.value)}
                  placeholder="Es. 800"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Parametri operativi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div>
                <Label info={{
                  titolo: 'Vacancy %',
                  testo: 'Percentuale di tempo in cui l\'immobile rimane sfitto all\'anno. Un valore tipico è 5-10%. Riduce il canone annuo incassato. Es.: con 5% su 12 mesi → 11,4 mesi di affitto effettivo.',
                }}>
                  Vacancy %
                </Label>
                <input type="number" step="0.5" value={val.vacancy_pct} onChange={e => upd('vacancy_pct', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <Label info={{
                  titolo: 'Cap Rate %',
                  testo: 'Capitalisation Rate: tasso di rendimento atteso dal mercato per questo tipo di immobile. Usato nel metodo reddituale per calcolare il valore dell\'immobile (Valore = NOI / Cap Rate). Valori tipici: 4-7%.',
                }}>
                  Cap Rate %
                </Label>
                <input type="number" step="0.1" value={val.cap_rate_pct} onChange={e => upd('cap_rate_pct', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <Label info={{
                  titolo: 'Spese Annue (€)',
                  testo: 'Totale delle spese operative annue in €: condominio, IMU, TARI, gestione, manutenzione ordinaria. Vengono sottratte dal canone per calcolare il NOI (reddito operativo netto).',
                }}>
                  Spese Annue (€)
                </Label>
                <input type="number" value={val.spese_annue} onChange={e => upd('spese_annue', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <Label info={{
                  titolo: 'Costi Acquisto %',
                  testo: 'Percentuale del prezzo di acquisto per coprire tutte le spese di rogito: notaio, imposte di registro (o IVA), agenzia immobiliare, spese ipotecarie. Tipicamente 8-12% del prezzo.',
                }}>
                  Costi Acquisto %
                </Label>
                <input type="number" step="0.5" value={val.costi_acquisto_pct} onChange={e => upd('costi_acquisto_pct', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
            </div>

            {/* Parametri mutuo */}
            <div>
              <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Finanziamento (opzionale)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                <div>
                  <Label info={{
                    titolo: 'LTV % (Loan-to-Value)',
                    testo: 'Percentuale del prezzo finanziata dalla banca tramite mutuo. LTV 80% = la banca presta l\'80% e tu paghi il 20% di tasca tua (equity). LTV 0% = acquisto cash senza mutuo.',
                  }}>
                    LTV %
                  </Label>
                  <input type="number" step="5" value={val.ltv_pct} onChange={e => upd('ltv_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <Label info={{
                    titolo: 'Tasso Mutuo %',
                    testo: 'Tasso di interesse annuo del mutuo. Può essere fisso (spread + IRS) o variabile (spread + Euribor). Influisce sulla rata mensile e quindi sul cash flow netto mensile.',
                  }}>
                    Tasso Mutuo %
                  </Label>
                  <input type="number" step="0.1" value={val.tasso_mutuo_pct} onChange={e => upd('tasso_mutuo_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <Label info={{
                    titolo: 'Durata Mutuo (anni)',
                    testo: 'Numero di anni del piano di ammortamento del mutuo. Durate tipiche: 10, 15, 20, 25, 30 anni. Durata più lunga = rata più bassa ma più interessi pagati in totale.',
                  }}>
                    Durata Anni
                  </Label>
                  <input type="number" value={val.durata_mutuo_anni} onChange={e => upd('durata_mutuo_anni', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <Label info={{
                    titolo: 'Orizzonte Temporale (anni)',
                    testo: 'Numero di anni per cui si proietta l\'analisi DCF. Rappresenta quanto a lungo prevedi di tenere l\'immobile prima di venderlo. Al termine si calcola il valore di rivendita (cap rate exit). Tipico: 5-10 anni.',
                  }}>
                    Orizzonte Anni
                  </Label>
                  <input type="number" min="1" max="20" value={val.orizzonte_anni} onChange={e => upd('orizzonte_anni', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Parametri avanzati DCF */}
            <div>
              <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Parametri Avanzati DCF</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                <div>
                  <Label info={{
                    titolo: 'Costi Ristrutturazione (€)',
                    testo: 'Costi iniziali per ristrutturare o migliorare l\'immobile in €. Vengono aggiunti al capitale investito e influenzano ROI e VAN. Inserisci 0 se l\'immobile non richiede lavori.',
                  }}>
                    Costi Ristrutturazione (€)
                  </Label>
                  <input type="number" value={val.costi_ristrutturazione} onChange={e => upd('costi_ristrutturazione', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <Label info={{
                    titolo: 'Tasso Crescita NOI %',
                    testo: 'Crescita annua attesa del reddito operativo netto (NOI) nel periodo di detenzione. Riflette l\'inflazione e la crescita dei canoni. Valori tipici: 1.5-3% annuo.',
                  }}>
                    Crescita NOI %/anno
                  </Label>
                  <input type="number" step="0.1" value={val.tasso_crescita_noi_pct} onChange={e => upd('tasso_crescita_noi_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
                <div>
                  <Label info={{
                    titolo: 'Tasso di Attualizzazione %',
                    testo: 'Il rendimento minimo richiesto per rendere l\'investimento conveniente (hurdle rate). I flussi di cassa futuri vengono scontati con questo tasso. Se il VAN è positivo, l\'investimento supera questo rendimento minimo. Tipico: 6-10%.',
                  }}>
                    Tasso Attualizzazione %
                  </Label>
                  <input type="number" step="0.1" value={val.tasso_attualizzazione_pct} onChange={e => upd('tasso_attualizzazione_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setStepAttivo(2)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                ← Indietro
              </button>
              <button
                onClick={eseguiAnalisiFinanziaria}
                disabled={loading || (!val.canone_mensile && !val.prezzo_acquisto)}
                className="disabled:opacity-40"
                style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {loading ? 'Analisi in corso...' : 'Calcola e Avanti →'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 4 - RISULTATI FINALI                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 4 && (
          <div className="flex flex-col gap-7">
            <div style={{ paddingBottom: 8 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>Risultati Valutazione</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {val.indirizzo || 'Immobile'} · {val.superficie_mq} mq · {val.tipologia}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* VCM */}
              {val.vcm && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--accent)' }}>Valutazione Comparativa (VCM)</p>
                  <RigaKPI label="Valore Minimo"  valore={formatEuro(val.vcm.valore_min)} />
                  <RigaKPI label="Valore Medio"   valore={formatEuro(val.vcm.valore_medio)} highlight />
                  <RigaKPI label="Valore Massimo" valore={formatEuro(val.vcm.valore_max)} />
                  <RigaKPI label="Prezzo base/mq" valore={`${formatEuro(val.vcm.prezzo_base_mq)}/mq`} />
                </div>
              )}

              {/* Reddituale */}
              {val.reddituale && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#3b82f6' }}>Analisi Reddituale</p>
                  <RigaKPI label="Valore di Mercato"  valore={formatEuro(val.reddituale.valore_mercato)} highlight />
                  <RigaKPI label="NOI Annuo"           valore={formatEuro(val.reddituale.noi_annuo)} />
                  <RigaKPI label="Rendimento Lordo"    valore={formatPct(val.reddituale.rendimento_lordo_pct)} colore="var(--success)" />
                  <RigaKPI label="Rendimento Netto"    valore={formatPct(val.reddituale.rendimento_netto_pct)} />
                </div>
              )}

              {/* DCF */}
              {val.dcf && (
                <div className="rounded-xl p-4 lg:col-span-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--success)' }}>Analisi DCF ({val.orizzonte_anni} anni)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'VAN (NPV)',    val: formatEuro(val.dcf.van),              ok: val.dcf.van > 0 },
                      { label: 'TIR (IRR)',    val: formatPct(val.dcf.tir_pct),           ok: val.dcf.tir_pct > 6 },
                      { label: 'ROI Totale',  val: formatPct(val.dcf.roi_totale_pct),     ok: true },
                      { label: 'Cash-on-Cash',val: formatPct(val.dcf.cash_on_cash_pct),  ok: val.dcf.cash_on_cash_pct > 0 },
                    ].map(kpi => (
                      <div key={kpi.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-card)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                        <p className="text-lg font-bold" style={{ color: kpi.ok ? 'var(--success)' : 'var(--danger)' }}>{kpi.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <RigaKPI label="Equity investita"   valore={formatEuro(val.dcf.equity)} />
                    <RigaKPI label="Rata mensile mutuo" valore={val.dcf.rata_mensile ? formatEuro(val.dcf.rata_mensile) : 'No mutuo'} />
                    <RigaKPI label="Valore rivendita"   valore={formatEuro(val.dcf.valore_rivendita_finale)} />
                  </div>
                  <div
                    className="mt-3 p-3 rounded-lg text-sm text-center font-medium"
                    style={{
                      background: val.dcf.investimento_conveniente ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: val.dcf.investimento_conveniente ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {val.dcf.investimento_conveniente
                      ? '✓ VAN positivo: l\'investimento crea valore rispetto al tasso richiesto'
                      : '⚠ VAN negativo: l\'investimento distrugge valore al tasso richiesto'}
                  </div>
                </div>
              )}
            </div>

            {/* Azioni */}
            {salvato ? (
              <div className="p-4 rounded-lg text-center" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>
                ✓ Valutazione salvata — la trovi in I Miei Investimenti › Valutazioni Eseguite!
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setStepAttivo(3)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  ← Modifica
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => salvaRisultati(false)}
                    disabled={loading}
                    className="disabled:opacity-40"
                    style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    Salva Valutazione
                  </button>
                  <button
                    onClick={() => salvaRisultati(true)}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#000' }}
                  >
                    {loading ? 'Salvataggio...' : 'Aggiungi al Portafoglio'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        </div>{/* fine ZONA 2 form */}
      </div>{/* fine card wizard */}
    </div>
  );
}
