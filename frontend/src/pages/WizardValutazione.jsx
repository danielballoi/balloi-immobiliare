/**
 * WizardValutazione - Wizard a 4 step per la valutazione immobiliare
 *
 * Step 1 - Dati Base Immobile: indirizzo, zona, tipologia, mq, piano, dotazioni
 * Step 2 - Mercato (VCM): calcola il valore comparativo di mercato
 * Step 3 - Costi/Reddito (DCF): analisi finanziaria con mutuo e flussi di cassa
 * Step 4 - Risultati: riepilogo completo, possibilità di salvare/portafoglio
 *
 * Il wizard mantiene tutti i dati in un unico stato "valutazione".
 * Ogni step legge/scrive su questo stato condiviso.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getZone, getTipologie, calcolaVCM, calcolaReddituale, calcolaDCF, salvaValutazione, aggiungiAPortafoglio } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

// ── Costanti ───────────────────────────────────────────────────────────────
const STATI_IMMOBILE = ['NORMALE', 'OTTIMO', 'SCADENTE'];
const PIANI = ['Piano terra', '1° piano', '2° piano', '3° piano', '4° piano', '5° piano o oltre'];

const formatEuro = (n) =>
  n != null && !isNaN(n) ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';
const formatPct = (n) =>
  n != null && !isNaN(n) ? `${Number(n).toFixed(1)}%` : '–';

/** Barra di avanzamento step */
function StepBar({ step, steps }) {
  return (
    <div className="flex items-center gap-2 mb-6">
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
          <span
            className="text-xs hidden sm:block"
            style={{ color: i === step ? 'var(--text-primary)' : 'var(--text-muted)' }}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-px"
              style={{ background: i < step ? 'var(--success)' : 'var(--border)' }}
            />
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
      <span
        className="text-sm font-semibold"
        style={{ color: colore ?? (highlight ? 'var(--accent)' : 'var(--text-primary)') }}
      >
        {valore}
      </span>
    </div>
  );
}

export default function WizardValutazione() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const zonaParam = searchParams.get('zona') ?? '';

  const [stepAttivo, setStepAttivo] = useState(0);
  const [zone, setZone]           = useState([]);
  const [tipologie, setTipologie] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [errore, setErrore]       = useState(null);
  const [salvato, setSalvato]     = useState(false);

  // ── Stato globale valutazione ─────────────────────────────────────────
  // Tutti i dati del wizard vivono qui. Ogni step ne legge/scrive una parte.
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
    // Risultati VCM (popolati dal backend)
    vcm: null,

    // Step 3 - Parametri Reddituale
    canone_mensile: '',
    vacancy_pct: 5,
    spese_annue: 0,
    cap_rate_pct: 5,
    // Risultati reddituale
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
    // Risultati DCF
    dcf: null,
  });

  // Funzione helper per aggiornare un campo di val
  const upd = (campo, valore) => setVal(prev => ({ ...prev, [campo]: valore }));

  // ── Caricamento dati di supporto ────────────────────────────────────
  useEffect(() => {
    console.log('[WIZARD] Caricamento zone e tipologie');
    Promise.all([getZone(), getTipologie()])
      .then(([z, t]) => {
        setZone(z);
        setTipologie(t);
        console.log(`[WIZARD] ${z.length} zone, ${t.length} tipologie`);
      })
      .catch(err => console.error('[WIZARD] Errore caricamento supporto:', err));
  }, []);

  // ── Step 2: Calcolo VCM ──────────────────────────────────────────────
  const eseguiVCM = async () => {
    setLoading(true);
    setErrore(null);
    console.log('[WIZARD] Calcolo VCM per zona:', val.zona_codice, 'tipo:', val.tipologia);

    try {
      const risultato = await calcolaVCM({
        zona_codice:     val.zona_codice,
        tipologia:       val.tipologia,
        stato:           val.stato_immobile,
        superficie_mq:   parseFloat(val.superficie_mq),
        piano:           val.piano,
        ascensore:       val.ascensore,
        box_auto:        val.box_auto,
        balcone_terrazza: val.balcone_terrazza,
        cantina:         val.cantina,
        prezzo_base_override: val.prezzo_base_override ? parseFloat(val.prezzo_base_override) : null,
      });
      console.log('[WIZARD] VCM risultato:', risultato);
      upd('vcm', risultato);
      // Pre-popola il prezzo_acquisto con il valore VCM medio
      if (!val.prezzo_acquisto) upd('prezzo_acquisto', risultato.valore_medio);
      setStepAttivo(2);
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
        // Calcola reddituale solo se canone inserito
        val.canone_mensile ? calcolaReddituale({
          canone_mensile: parseFloat(val.canone_mensile),
          vacancy_pct: parseFloat(val.vacancy_pct),
          spese_annue: parseFloat(val.spese_annue),
          cap_rate_pct: parseFloat(val.cap_rate_pct),
          superficie_mq: parseFloat(val.superficie_mq),
        }) : Promise.resolve(null),

        // Calcola DCF solo se prezzo_acquisto e canone inseriti
        (val.prezzo_acquisto && val.canone_mensile) ? calcolaDCF({
          prezzo_acquisto:         parseFloat(val.prezzo_acquisto),
          costi_acquisto_pct:      parseFloat(val.costi_acquisto_pct),
          costi_ristrutturazione:  parseFloat(val.costi_ristrutturazione || 0),
          ltv_pct:                 parseFloat(val.ltv_pct),
          tasso_mutuo_pct:         parseFloat(val.tasso_mutuo_pct),
          durata_mutuo_anni:       parseInt(val.durata_mutuo_anni),
          canone_mensile:          parseFloat(val.canone_mensile),
          vacancy_pct:             parseFloat(val.vacancy_pct),
          spese_operative_annue:   parseFloat(val.spese_annue || 0),
          tasso_crescita_noi_pct:  parseFloat(val.tasso_crescita_noi_pct),
          orizzonte_anni:          parseInt(val.orizzonte_anni),
          tasso_attualizzazione_pct: parseFloat(val.tasso_attualizzazione_pct),
          cap_rate_exit_pct:       parseFloat(val.cap_rate_exit_pct),
        }) : Promise.resolve(null),
      ]);

      console.log('[WIZARD] Reddituale:', red, 'DCF:', dcf);
      setVal(prev => ({ ...prev, reddituale: red, dcf: dcf }));
      setStepAttivo(3);
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
      // Costruisce il payload flat per il DB (vedi schema tabella valutazioni)
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
        // VCM
        ...(val.vcm && {
          vcm_prezzo_base_mq:       val.vcm.prezzo_base_mq,
          vcm_valore_min:           val.vcm.valore_min,
          vcm_valore_medio:         val.vcm.valore_medio,
          vcm_valore_max:           val.vcm.valore_max,
          vcm_numero_comparabili:   val.vcm.numero_comparabili,
        }),
        // Reddituale
        ...(val.reddituale && {
          red_canone_mensile_lordo:  val.canone_mensile,
          red_noi_annuo:             val.reddituale.noi_annuo,
          red_spese_annue:           val.spese_annue,
          red_vacancy_pct:           val.vacancy_pct,
          red_cap_rate_pct:          val.cap_rate_pct,
          red_valore_mercato:        val.reddituale.valore_mercato,
          red_rendimento_lordo_pct:  val.reddituale.rendimento_lordo_pct,
          red_rendimento_netto_pct:  val.reddituale.rendimento_netto_pct,
        }),
        // DCF
        ...(val.dcf && {
          dcf_prezzo_acquisto:           val.prezzo_acquisto,
          dcf_costi_acquisto_pct:        val.costi_acquisto_pct,
          dcf_costi_ristrutturazione:    val.costi_ristrutturazione,
          dcf_capitale_investito:        val.dcf.equity,
          dcf_ltv_pct:                   val.ltv_pct,
          dcf_tasso_mutuo_pct:           val.tasso_mutuo_pct,
          dcf_durata_mutuo_anni:         val.durata_mutuo_anni,
          dcf_rata_mensile:              val.dcf.rata_mensile,
          dcf_orizzonte_anni:            val.orizzonte_anni,
          dcf_tasso_crescita_noi_pct:    val.tasso_crescita_noi_pct,
          dcf_tasso_attualizzazione_pct: val.tasso_attualizzazione_pct,
          dcf_valore_rivendita_finale:   val.dcf.valore_rivendita_finale,
          dcf_van:                       val.dcf.van,
          dcf_tir_pct:                   val.dcf.tir_pct,
          dcf_roi_totale_pct:            val.dcf.roi_totale_pct,
          dcf_cash_on_cash_pct:          val.dcf.cash_on_cash_pct,
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

  const STEPS = ['Dati Immobile', 'Mercato', 'Costi & Reddito', 'Risultati'];

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Nuova Valutazione</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Wizard guidato · 4 passaggi</p>
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <StepBar step={stepAttivo} steps={STEPS} />

        {errore && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
            ⚠ {errore}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 0 - DATI BASE IMMOBILE                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 0 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Dati Base Immobile</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Inserisci le informazioni principali della proprietà per iniziare l'analisi.
              </p>
            </div>

            {/* Indirizzo + Zona */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Indirizzo Completo</label>
                <input
                  value={val.indirizzo}
                  onChange={e => upd('indirizzo', e.target.value)}
                  placeholder="Es. Via Roma, 12"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Quartiere (Cagliari)*</label>
                <select
                  required
                  value={val.zona_codice}
                  onChange={e => upd('zona_codice', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">Seleziona zona...</option>
                  {zone.map(z => (
                    <option key={z.id} value={z.link_zona}>
                      {z.descrizione_zona} ({z.link_zona})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipologia + Superficie + Stato */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Tipologia*</label>
                <select
                  required
                  value={val.tipologia}
                  onChange={e => upd('tipologia', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="">Seleziona...</option>
                  {tipologie.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Superficie (mq)*</label>
                <input
                  required
                  type="number" step="0.5" min="1"
                  value={val.superficie_mq}
                  onChange={e => upd('superficie_mq', e.target.value)}
                  placeholder="Es. 80"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Stato Immobile*</label>
                <select
                  value={val.stato_immobile}
                  onChange={e => upd('stato_immobile', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {STATI_IMMOBILE.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Piano + Anno costruzione */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Piano</label>
                <select
                  value={val.piano}
                  onChange={e => upd('piano', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {PIANI.map((p, i) => <option key={i} value={i}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Anno di Costruzione</label>
                <input
                  type="number" min="1900" max={new Date().getFullYear()}
                  value={val.anno_costruzione}
                  onChange={e => upd('anno_costruzione', e.target.value)}
                  placeholder="Es. 1980"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Dotazioni aggiuntive (checkbox) */}
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Caratteristiche Aggiuntive</label>
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

            {/* Bottone avanti */}
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setStepAttivo(1)}
                disabled={!val.zona_codice || !val.tipologia || !val.superficie_mq}
                className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 1 - VALUTAZIONE COMPARATIVA (VCM)                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Analisi di Mercato (VCM)</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Stima il valore basandosi sui prezzi OMI comparabili della zona.
              </p>
            </div>

            {/* Riepilogo step 1 */}
            <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex flex-wrap gap-4">
                <span style={{ color: 'var(--text-muted)' }}>Zona: <strong style={{ color: 'var(--text-primary)' }}>{val.zona_codice}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Tipologia: <strong style={{ color: 'var(--text-primary)' }}>{val.tipologia}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Mq: <strong style={{ color: 'var(--text-primary)' }}>{val.superficie_mq} mq</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Stato: <strong style={{ color: 'var(--text-primary)' }}>{val.stato_immobile}</strong></span>
              </div>
            </div>

            {/* Override prezzo base (opzionale) */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Prezzo base personalizzato €/mq (lascia vuoto per usare i dati OMI)
              </label>
              <input
                type="number" step="10"
                value={val.prezzo_base_override}
                onChange={e => upd('prezzo_base_override', e.target.value)}
                placeholder="Es. 1800 (opzionale)"
                className="w-full max-w-xs px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Risultato VCM (dopo calcolo) */}
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
                <div className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Prezzo base: {formatEuro(val.vcm.prezzo_base_mq)}/mq ·
                  Coeff. piano: {val.vcm.coefficiente_piano} ·
                  {val.vcm.numero_comparabili} comparabili OMI
                </div>
              </div>
            )}

            <div className="flex justify-between gap-3">
              <button onClick={() => setStepAttivo(0)} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                ← Indietro
              </button>
              <button
                onClick={eseguiVCM}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                {loading ? 'Calcolo in corso...' : val.vcm ? 'Ricalcola e Avanti →' : 'Calcola VCM →'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 2 - ANALISI REDDITUALE + DCF                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Costi & Analisi Reddituale</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Inserisci i dati finanziari per il calcolo DCF e reddituale.
              </p>
            </div>

            {/* Prezzo acquisto + canone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Prezzo Acquisto (€)</label>
                <input
                  type="number"
                  value={val.prezzo_acquisto}
                  onChange={e => upd('prezzo_acquisto', e.target.value)}
                  placeholder={val.vcm ? `Es. ${val.vcm.valore_medio}` : 'Es. 200000'}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Canone Mensile Lordo (€)</label>
                <input
                  type="number"
                  value={val.canone_mensile}
                  onChange={e => upd('canone_mensile', e.target.value)}
                  placeholder="Es. 800"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Parametri operativi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Vacancy %</label>
                <input type="number" step="0.5" value={val.vacancy_pct} onChange={e => upd('vacancy_pct', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Cap Rate %</label>
                <input type="number" step="0.1" value={val.cap_rate_pct} onChange={e => upd('cap_rate_pct', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Spese Annue (€)</label>
                <input type="number" value={val.spese_annue} onChange={e => upd('spese_annue', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Costi Acquisto %</label>
                <input type="number" step="0.5" value={val.costi_acquisto_pct} onChange={e => upd('costi_acquisto_pct', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            {/* Parametri mutuo */}
            <div>
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Finanziamento (opzionale)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>LTV %</label>
                  <input type="number" step="5" value={val.ltv_pct} onChange={e => upd('ltv_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Tasso Mutuo %</label>
                  <input type="number" step="0.1" value={val.tasso_mutuo_pct} onChange={e => upd('tasso_mutuo_pct', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Durata Anni</label>
                  <input type="number" value={val.durata_mutuo_anni} onChange={e => upd('durata_mutuo_anni', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Orizzonte Anni</label>
                  <input type="number" min="1" max="20" value={val.orizzonte_anni} onChange={e => upd('orizzonte_anni', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <button onClick={() => setStepAttivo(1)} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                ← Indietro
              </button>
              <button
                onClick={eseguiAnalisiFinanziaria}
                disabled={loading || (!val.canone_mensile && !val.prezzo_acquisto)}
                className="px-6 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                {loading ? 'Analisi in corso...' : 'Calcola e Avanti →'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 3 - RISULTATI FINALI                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Risultati Valutazione</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--info)' }}>Analisi Reddituale</p>
                  <RigaKPI label="Valore di Mercato"    valore={formatEuro(val.reddituale.valore_mercato)} highlight />
                  <RigaKPI label="NOI Annuo"            valore={formatEuro(val.reddituale.noi_annuo)} />
                  <RigaKPI label="Rendimento Lordo"     valore={formatPct(val.reddituale.rendimento_lordo_pct)} positive colore="var(--success)" />
                  <RigaKPI label="Rendimento Netto"     valore={formatPct(val.reddituale.rendimento_netto_pct)} />
                </div>
              )}

              {/* DCF */}
              {val.dcf && (
                <div className="rounded-xl p-4 lg:col-span-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--success)' }}>Analisi DCF ({val.orizzonte_anni} anni)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'VAN (NPV)',         val: formatEuro(val.dcf.van), ok: val.dcf.van > 0 },
                      { label: 'TIR (IRR)',         val: formatPct(val.dcf.tir_pct), ok: val.dcf.tir_pct > 6 },
                      { label: 'ROI Totale',        val: formatPct(val.dcf.roi_totale_pct), ok: true },
                      { label: 'Cash-on-Cash',      val: formatPct(val.dcf.cash_on_cash_pct), ok: val.dcf.cash_on_cash_pct > 0 },
                    ].map(kpi => (
                      <div key={kpi.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-card)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                        <p className="text-lg font-bold" style={{ color: kpi.ok ? 'var(--success)' : 'var(--danger)' }}>{kpi.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <RigaKPI label="Equity investita"     valore={formatEuro(val.dcf.equity)} />
                    <RigaKPI label="Rata mensile mutuo"   valore={val.dcf.rata_mensile ? formatEuro(val.dcf.rata_mensile) : 'No mutuo'} />
                    <RigaKPI label="Valore rivendita"     valore={formatEuro(val.dcf.valore_rivendita_finale)} />
                  </div>

                  {/* Flag VAN */}
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
                ✓ Valutazione salvata correttamente!
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <button onClick={() => setStepAttivo(2)} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                  ← Modifica
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => salvaRisultati(false)}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
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
      </div>
    </div>
  );
}
