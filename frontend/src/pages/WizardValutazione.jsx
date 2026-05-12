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

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getZone, calcolaReddituale,
  calcolaDCF, salvaValutazione, aggiungiAPortafoglio,
  getHeatmap,
} from '../services/api';
import StradeAutocomplete from '../components/StradeAutocomplete';
import LoadingSpinner from '../components/LoadingSpinner';
import { TIPOLOGIE_CATASTALI, GRUPPI_TIPOLOGIE } from '../data/tipologieData';

// ── Costanti ───────────────────────────────────────────────────────────────
const STATI_IMMOBILE = ['NORMALE', 'OTTIMO', 'SCADENTE'];
const PIANI = ['Piano terra', '1° piano', '2° piano', '3° piano', '4° piano', '5° piano o oltre'];
const STEPS = ['Tipo Area', 'Dati Immobile', 'Prezzo Reale', 'Parametri', 'Risultati'];

const formatEuro = (n) =>
  n != null && !isNaN(n) ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';
const formatPct = (n) =>
  n != null && !isNaN(n) ? `${Number(n).toFixed(1)}%` : '–';

/**
 * Calcola un punteggio di qualità 0-100 dalle caratteristiche dell'immobile.
 * Usato per interpolare il prezzo/mq nell'intervallo OMI compr_min ÷ compr_max.
 *
 * Base 50. Ogni caratteristica sposta il punteggio; il risultato viene
 * bloccato a [0, 100] prima della restituzione.
 */
function calcolaPunteggioQualita({ stato_conservazione, classe_energetica, esposizione, vista, qualita_costruzione, luminosita, ascensore, num_balconi, cantina, box_auto, piano }) {
  let score = 50;

  if (stato_conservazione === 'OTTIMO')    score += 20;
  if (stato_conservazione === 'SCADENTE')  score -= 20;

  if (classe_energetica === 'ALTA')  score += 10;
  if (classe_energetica === 'BASSA') score -= 10;

  if (esposizione === 'OTTIMA')  score += 8;
  if (esposizione === 'SCARSA')  score -= 8;

  if (vista === 'PREGIATA') score += 10;
  if (vista === 'COMUNE')   score -= 5;

  if (qualita_costruzione === 'PREGIATA')  score += 8;
  if (qualita_costruzione === 'ECONOMICA') score -= 8;

  if (luminosita === 'OTTIMA') score += 6;
  if (luminosita === 'SCARSA') score -= 6;

  if (ascensore) score += 3;
  if (box_auto)  score += 3;
  if (cantina)   score += 1;
  score += Math.min(parseInt(num_balconi) || 0, 2) * 2;

  // Piano: con ascensore favorisce intermedi, senza ascensore penalizza alti
  const pianoBonusConAsc    = [-5, -2, 0, 2, 3, 2];
  const pianoBonusSenzaAsc  = [-3, -1, 0, -1, -4, -7];
  const pianoIdx = Math.min(parseInt(piano) || 0, 5);
  score += (ascensore ? pianoBonusConAsc : pianoBonusSenzaAsc)[pianoIdx];

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Interpreta un prezzo scritto dall'utente in formato italiano e restituisce il numero.
 *   "201.400"     → 201400  (punto = separatore migliaia)
 *   "201.400,50"  → 201400  (formato italiano completo)
 *   "201400"      → 201400  (numero semplice)
 *   "201.4"       → 201     (punto decimale → arrotonda)
 * Usato per i campi prezzo nel wizard prima di inviare al backend.
 */
function parsePrezzoNumerico(val) {
  if (!val && val !== 0) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Formato con virgola → virgola = decimale, punti = migliaia
  if (s.includes(',')) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : Math.round(n);
  }
  const dots = (s.match(/\./g) || []).length;
  // Più punti → tutti migliaia: 1.500.000 → 1500000
  if (dots > 1) { const n = parseInt(s.replace(/\./g, ''), 10); return isNaN(n) ? null : n; }
  if (dots === 1) {
    const after = s.split('.')[1];
    // Esattamente 3 cifre dopo il punto → separatore migliaia: 201.400 → 201400
    if (after && after.length === 3) { const n = parseInt(s.replace('.', ''), 10); return isNaN(n) ? null : n; }
    // Punto decimale: 201.4 → 201 (arrotondato)
    const n = parseFloat(s);
    return isNaN(n) ? null : Math.round(n);
  }
  // Numero senza separatori
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

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
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '11px 16px', borderRadius: 8, marginBottom: 6,
        background: highlight ? 'rgba(245,158,11,0.08)' : 'rgba(0,0,0,0.08)',
        border: `1px solid ${highlight ? 'rgba(245,158,11,0.22)' : 'var(--border)'}`,
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: colore ?? (highlight ? 'var(--accent)' : 'var(--text-primary)') }}>
        {valore}
      </span>
    </div>
  );
}

function InfoIcon({ titolo, testo }) {
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    const onKey = (e) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aperto]);

  return (
    <div className="relative inline-flex items-center">
      {aperto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'transparent',
            cursor: 'default',
          }}
          onMouseDown={() => setAperto(false)}
          onTouchStart={() => setAperto(false)}
        />
      )}

      <button
        type="button"
        onMouseDown={(e) => {
          e.stopPropagation();
          setAperto(v => !v);
        }}
        style={{
          marginLeft: 6,
          width: 16,
          height: 16,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          background: aperto ? 'var(--accent)' : 'rgba(100,116,139,0.35)',
          color: aperto ? '#000' : 'var(--text-muted)',
          position: 'relative',
          zIndex: 9999,
          flexShrink: 0,
        }}
      >
        i
      </button>

      {aperto && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 8,
            width: 280,
            zIndex: 9999,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              {titolo}
            </span>
            <button
              onMouseDown={(e) => { e.stopPropagation(); setAperto(false); }}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: 18, lineHeight: 1, padding: '0 0 0 8px',
              }}
            >×</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            {testo}
          </p>
        </div>
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

  const [zone, setZone]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [errore, setErrore]           = useState(null);

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
    num_locali: '',
    num_bagni: '',
    url_annuncio: '',
    ascensore: false,
    box_auto: false,
    balcone_terrazza: false,
    cantina: false,

    // Step 2 - Prezzo reale
    prezzo_dichiarato: '',
    fonte_prezzo: '',
    note_prezzo: '',

    // Step 2 - Metodi selezionati (array: 'REDDITUALE' | 'DCF')
    metodiSelezionati: ['REDDITUALE'],

    // Parametri VCM (mantenuto per compatibilità legacy)
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

    // ── Caratteristiche immobile (sistema 3 livelli → fascia OMI) ───────────
    classe_energetica: 'MEDIA',
    esposizione: 'BUONA',
    vista: 'STANDARD',
    qualita_costruzione: 'STANDARD',
    luminosita: 'BUONA',
    stato_conservazione: 'NORMALE',

    // ── Tipo valutazione selezionata (radio step 3) ──────────────────────
    tipoValutazione: 'REDDITUALE',

    // ── Fallback manuale se dati OMI assenti ─────────────────────────────
    prezzo_medio_manuale: '',

    // ── Caratteristiche avanzate superfici/box ────────────────────────────
    box_dimensione: 'nessuno',
    num_balconi: 0,
    terrazza_mq: 0,
    giardino_mq: 0,
    comparabili_manuali: [],
    tipo_superficie: 'commerciale',

    // ── Spese breakdown reddituale ────────────────────────────────────────
    spese_imu: 0,
    spese_condominio: 0,
    spese_manutenzione: 0,
    spese_assicurazione: 0,
    spese_gestione: 0,
    spese_altre: 0,
    tipo_locazione: 'lunga_libero',

    // ── DCF avanzato ──────────────────────────────────────────────────────
    costi_vendita_pct: 3,
    plusvalenza_regime: 'esente',
    scenario_pess_crescita: 0,
    scenario_ott_crescita: 3,
    scenario_pess_vacancy: 10,
    scenario_ott_vacancy: 3,
    scenario_pess_capexit: 6,
    scenario_ott_capexit: 4,

    // ── Riconciliazione pesi ──────────────────────────────────────────────
    peso_vcm: 60,
    peso_red: 40,
    peso_dcf: 0,
  });

  const upd = (campo, valore) => setVal(prev => ({ ...prev, [campo]: valore }));

  // ── Caricamento zone e tipologie ────────────────────────────────────
  useEffect(() => {
    console.log('[WIZARD] Caricamento zone');
    Promise.all([getZone(), getHeatmap(null, 'HINTERLAND')])
      .then(([cagliariZone, hinterlandZone]) => {
        const tutte = [
          ...cagliariZone.map(z => ({ ...z, area: z.area || 'CAGLIARI' })),
          ...hinterlandZone.map(z => ({ ...z, area: 'HINTERLAND' })),
        ];
        setZone(tutte);
        console.log(`[WIZARD] ${tutte.length} zone totali`);
      })
      .catch(err => console.error('[WIZARD] Errore caricamento zone:', err));
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

  // ── Step 3: calcola tutti i metodi selezionati in parallelo ─────────
  const eseguiAnalisi = async () => {
    setLoading(true);
    setErrore(null);
    try {
      const haRED = val.metodiSelezionati.includes('REDDITUALE');
      const haDCF = val.metodiSelezionati.includes('DCF');
      const prezzoAcq = parsePrezzoNumerico(val.prezzo_dichiarato)
        ?? parsePrezzoNumerico(val.prezzo_acquisto)
        ?? (val.prezzo_acquisto ? parseFloat(val.prezzo_acquisto) : null);

      // Spese totali: se breakdown compilato usa la somma, else il campo singolo legacy
      const speseTotali = (() => {
        const breakdown = parseFloat(val.spese_imu||0) + parseFloat(val.spese_condominio||0)
          + parseFloat(val.spese_manutenzione||0) + parseFloat(val.spese_assicurazione||0)
          + parseFloat(val.spese_gestione||0) + parseFloat(val.spese_altre||0);
        return breakdown > 0 ? breakdown : parseFloat(val.spese_annue || 0);
      })();

      // Reddituale: se RED o DCF sono selezionati (DCF ne ha bisogno)
      const redPromise = (haRED || haDCF)
        ? calcolaReddituale({
            canone_mensile:  parseFloat(val.canone_mensile),
            vacancy_pct:     parseFloat(val.vacancy_pct),
            spese_annue:     speseTotali,
            cap_rate_pct:    parseFloat(val.cap_rate_pct),
            superficie_mq:   parseFloat(val.superficie_mq),
            prezzo_acquisto: prezzoAcq,
          })
        : Promise.resolve(null);

      // DCF: solo se esplicitamente selezionato
      const dcfPromise = haDCF
        ? calcolaDCF({
            prezzo_acquisto:           prezzoAcq,
            costi_acquisto_pct:        parseFloat(val.costi_acquisto_pct),
            costi_ristrutturazione:    parseFloat(val.costi_ristrutturazione || 0),
            ltv_pct:                   parseFloat(val.ltv_pct),
            tasso_mutuo_pct:           parseFloat(val.tasso_mutuo_pct),
            durata_mutuo_anni:         parseInt(val.durata_mutuo_anni),
            canone_mensile:            parseFloat(val.canone_mensile),
            vacancy_pct:               parseFloat(val.vacancy_pct),
            spese_operative_annue:     speseTotali,
            tasso_crescita_noi_pct:    parseFloat(val.tasso_crescita_noi_pct),
            orizzonte_anni:            parseInt(val.orizzonte_anni),
            tasso_attualizzazione_pct: parseFloat(val.tasso_attualizzazione_pct),
            cap_rate_exit_pct:         parseFloat(val.cap_rate_exit_pct),
            costi_vendita_pct:         parseFloat(val.costi_vendita_pct || 3),
            calcola_sensitivity:       true,
          })
        : Promise.resolve(null);

      const [redRis, dcfRis] = await Promise.all([redPromise, dcfPromise]);
      console.log('[WIZARD] RED:', redRis, '| DCF:', dcfRis);
      setVal(prev => ({ ...prev, reddituale: redRis, dcf: dcfRis }));
      setStepAttivo(4);
    } catch (err) {
      console.error('[WIZARD] Errore analisi:', err);
      setErrore(err.response?.data?.error ?? 'Errore durante il calcolo. Verifica i dati inseriti.');
    } finally {
      setLoading(false);
    }
  };

  // ── Salvataggio valutazione ──────────────────────────────────────────
  const salvaRisultati = async () => {
    setLoading(true);
    setErrore(null);
    // Converte stringa vuota → null per i campi numerici (evita errori MySQL strict mode)
    const n = v => (v === '' || v === null || v === undefined) ? null : Number(v);
    try {
      const payload = {
        indirizzo:        val.indirizzo || null,
        zona_codice:      val.zona_codice || null,
        tipologia:        val.tipologia || null,
        stato_immobile:   val.stato_immobile || null,
        superficie_mq:    n(val.superficie_mq),
        piano:            n(val.piano),
        anno_costruzione: n(val.anno_costruzione),
        num_locali:       n(val.num_locali),
        num_bagni:        n(val.num_bagni),
        url_annuncio:     val.url_annuncio || null,
        ascensore:        val.ascensore ? 1 : 0,
        box_auto:         val.box_auto ? 1 : 0,
        balcone_terrazza: val.balcone_terrazza ? 1 : 0,
        cantina:          val.cantina ? 1 : 0,

        // Caratteristiche a 3 livelli
        classe_energetica:    val.classe_energetica,
        esposizione:          val.esposizione,
        vista:                val.vista,
        qualita_costruzione:  val.qualita_costruzione,
        luminosita:           val.luminosita,
        stato_conservazione:  val.stato_conservazione,
        tipo_valutazione:     val.tipoValutazione,

        // Prezzo reale dichiarato
        prezzo_dichiarato: parsePrezzoNumerico(val.prezzo_dichiarato),
        fonte_prezzo:      val.fonte_prezzo || null,
        note_prezzo:       val.note_prezzo || null,

        ...(val.reddituale && {
          red_canone_mensile_lordo: n(val.canone_mensile),
          red_noi_annuo:            n(val.reddituale.noi_annuo),
          red_spese_annue:          n(val.spese_annue),
          red_vacancy_pct:          n(val.vacancy_pct),
          red_cap_rate_pct:         n(val.cap_rate_pct),
          red_valore_mercato:       n(val.reddituale.valore_mercato),
          red_rendimento_lordo_pct: n(val.reddituale.rendimento_lordo_pct),
          red_rendimento_netto_pct: n(val.reddituale.rendimento_netto_pct),
        }),
        ...(val.dcf && {
          dcf_prezzo_acquisto:            parsePrezzoNumerico(val.prezzo_dichiarato) ?? parsePrezzoNumerico(val.prezzo_acquisto) ?? null,
          dcf_costi_acquisto_pct:         n(val.costi_acquisto_pct),
          dcf_costi_ristrutturazione:     n(val.costi_ristrutturazione),
          dcf_capitale_investito:         n(val.dcf.equity),
          dcf_ltv_pct:                    n(val.ltv_pct),
          dcf_tasso_mutuo_pct:            n(val.tasso_mutuo_pct),
          dcf_durata_mutuo_anni:          n(val.durata_mutuo_anni),
          dcf_rata_mensile:               n(val.dcf.rata_mensile),
          dcf_orizzonte_anni:             n(val.orizzonte_anni),
          dcf_tasso_crescita_noi_pct:     n(val.tasso_crescita_noi_pct),
          dcf_tasso_attualizzazione_pct:  n(val.tasso_attualizzazione_pct),
          dcf_valore_rivendita_finale:    n(val.dcf.valore_rivendita_finale),
          dcf_van:                        n(val.dcf.van),
          dcf_tir_pct:                    n(val.dcf.tir_pct),
          dcf_roi_totale_pct:             n(val.dcf.roi_totale_pct),
          dcf_cash_on_cash_pct:           n(val.dcf.cash_on_cash_pct),
        }),
        metodologia_principale: 'REDDITUALE',
        salvato_portafoglio: 1,
      };

      const { valutazione_id } = await salvaValutazione(payload);
      console.log('[WIZARD] Valutazione salvata ID:', valutazione_id);

      await aggiungiAPortafoglio({
        valutazione_id,
        indirizzo:           val.indirizzo || null,
        zona_codice:         val.zona_codice || null,
        tipologia:           val.tipologia || null,
        stato_immobile:      val.stato_immobile || null,
        superficie_mq:       n(val.superficie_mq),
        num_locali:          n(val.num_locali),
        num_bagni:           n(val.num_bagni),
        url_annuncio:        val.url_annuncio || null,
        prezzo_acquisto:     parsePrezzoNumerico(val.prezzo_dichiarato) ?? parsePrezzoNumerico(val.prezzo_acquisto) ?? null,
        fonte_prezzo:        val.fonte_prezzo || null,
        canone_mensile:      n(val.canone_mensile),
        tir_pct:             n(val.dcf?.tir_pct),
        roi_totale_pct:      n(val.dcf?.roi_totale_pct),
        van:                 n(val.dcf?.van),
        // Caratteristiche e fascia
        classe_energetica:   val.classe_energetica,
        esposizione:         val.esposizione,
        vista:               val.vista,
        qualita_costruzione: val.qualita_costruzione,
        luminosita:          val.luminosita,
        stato_conservazione: val.stato_conservazione,
        tipo_valutazione:    val.tipoValutazione,
      });

      navigate('/portafoglio?tab=valutazioni');
    } catch (err) {
      console.error('[WIZARD] Errore salvataggio:', err);
      setErrore('Errore durante il salvataggio. Controlla i dati inseriti.');
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
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analisi Investimento</h1>
        <p className="text-sm" style={{ marginTop: 6, color: 'var(--text-muted)' }}>Analisi finanziaria guidata · inserisci i dati reali</p>
      </div>

      {/* ── Card wizard: due zone visive distinte ─────────────────────────── */}
      <div className="rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

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
                <Label>Via / Indirizzo *</Label>
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
                    required
                    value={val.indirizzo}
                    onChange={e => upd('indirizzo', e.target.value)}
                    placeholder="Es. Via Roma, 12 – Quartu"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ ...inputStyle, borderColor: !val.indirizzo ? 'rgba(245,158,11,0.6)' : 'var(--border)' }}
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
                  <>
                    <select
                      required
                      value={val.zona_codice}
                      onChange={e => upd('zona_codice', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={inputStyle}
                    >
                      <option value="">Seleziona comune / zona...</option>
                      {(() => {
                        const zoneHint = zone
                          .filter(z => z.area === 'HINTERLAND' && z.comune)
                          .sort((a, b) =>
                            (a.comune ?? '').localeCompare(b.comune ?? '') ||
                            (a.descrizione_zona ?? '').localeCompare(b.descrizione_zona ?? '')
                          );
                        const comuniMap = {};
                        zoneHint.forEach(z => {
                          if (!comuniMap[z.comune]) comuniMap[z.comune] = [];
                          comuniMap[z.comune].push(z);
                        });
                        return Object.entries(comuniMap).map(([comune, zoneComune]) =>
                          zoneComune.length === 1 ? (
                            <option key={zoneComune[0].link_zona} value={zoneComune[0].link_zona}>
                              {comune}
                            </option>
                          ) : (
                            <optgroup key={comune} label={comune}>
                              {zoneComune.map(z => (
                                <option key={z.link_zona} value={z.link_zona}>
                                  {z.descrizione_zona?.replace(/^'+|'+$/g, '').trim()}
                                </option>
                              ))}
                            </optgroup>
                          )
                        );
                      })()}
                    </select>
                    {val.zona_codice && (
                      <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>
                        ✓ Zona: {zone.find(z => z.link_zona === val.zona_codice)?.descrizione_zona?.replace(/^'+|'+$/g, '').trim() || val.zona_codice}
                      </p>
                    )}
                  </>
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
                  <option value="">Seleziona tipologia...</option>
                  {GRUPPI_TIPOLOGIE.map(gruppo => (
                    <optgroup key={gruppo} label={gruppo}>
                      {TIPOLOGIE_CATASTALI.filter(t => t.gruppo === gruppo).map(t => (
                        <option key={t.catastale} value={t.nome}>
                          {t.nome} ({t.catastale})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <Label>Superficie commerciale (mq)*</Label>
                <input
                  required
                  type="number" step="0.5" min="1" max="1000"
                  value={val.superficie_mq}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '') { upd('superficie_mq', ''); return; }
                    const n = parseFloat(v);
                    if (!isNaN(n) && n < 0) return;
                    if (!isNaN(n) && n > 1000) { upd('superficie_mq', '1000'); return; }
                    upd('superficie_mq', v);
                  }}
                  placeholder="Es. 80 (max 1000 mq)"
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
                  type="number" min="1899" max={new Date().getFullYear()}
                  value={val.anno_costruzione}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '') { upd('anno_costruzione', ''); return; }
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n > new Date().getFullYear()) return;
                    upd('anno_costruzione', v);
                  }}
                  placeholder="Es. 1980"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* N° Locali + N° Bagni */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label>N° Locali</Label>
                <input
                  type="number" min="1" max="10"
                  value={val.num_locali}
                  onChange={e => upd('num_locali', e.target.value)}
                  placeholder="Es. 3"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>N° Bagni</Label>
                <input
                  type="number" min="1" max="5"
                  value={val.num_bagni}
                  onChange={e => upd('num_bagni', e.target.value)}
                  placeholder="Es. 1"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* URL Annuncio */}
            <div>
              <Label>URL Annuncio</Label>
              <input
                type="url"
                value={val.url_annuncio}
                onChange={e => upd('url_annuncio', e.target.value)}
                placeholder="https://www.immobiliare.it/..."
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
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

            {/* ── CARATTERISTICHE IMMOBILE (3 livelli → fascia OMI) ── */}
            <div style={{ marginTop: 8, paddingTop: 28, borderTop: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Caratteristiche Immobile
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Determinano la fascia OMI (BASSA / MEDIA / ALTA) e quindi il prezzo base della valutazione.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <Label info={{ titolo: 'Classe Energetica', testo: 'ALTA (A-B) → fascia MAX OMI. BASSA (F-G) → fascia MIN OMI. Dati da APE.' }}>
                    Classe Energetica *
                  </Label>
                  <select value={val.classe_energetica} onChange={e => upd('classe_energetica', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                    <option value="BASSA">BASSA (F-G)</option>
                    <option value="MEDIA">MEDIA (C-D-E)</option>
                    <option value="ALTA">ALTA (A-B)</option>
                  </select>
                </div>
                <div>
                  <Label info={{ titolo: 'Esposizione', testo: 'OTTIMA (Sud) contribuisce alla fascia alta. SCARSA (Nord) alla fascia bassa.' }}>
                    Esposizione *
                  </Label>
                  <select value={val.esposizione} onChange={e => upd('esposizione', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                    <option value="SCARSA">SCARSA (Nord)</option>
                    <option value="BUONA">BUONA (Est/Ovest)</option>
                    <option value="OTTIMA">OTTIMA (Sud)</option>
                  </select>
                </div>
                <div>
                  <Label info={{ titolo: 'Vista / Affaccio', testo: 'PREGIATA (mare/panorama) porta alla fascia alta. COMUNE (cortile) alla bassa.' }}>
                    Vista *
                  </Label>
                  <select value={val.vista} onChange={e => upd('vista', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                    <option value="COMUNE">COMUNE (Cortile/Interno)</option>
                    <option value="STANDARD">STANDARD (Strada)</option>
                    <option value="PREGIATA">PREGIATA (Mare/Panorama)</option>
                  </select>
                </div>
                <div>
                  <Label info={{ titolo: 'Qualità Costruzione', testo: 'PREGIATA = finiture di pregio. ECONOMICA = materiali base.' }}>
                    Qualità Costruzione *
                  </Label>
                  <select value={val.qualita_costruzione} onChange={e => upd('qualita_costruzione', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                    <option value="ECONOMICA">ECONOMICA</option>
                    <option value="STANDARD">STANDARD</option>
                    <option value="PREGIATA">PREGIATA</option>
                  </select>
                </div>
                <div>
                  <Label info={{ titolo: 'Luminosità', testo: 'OTTIMA = luce naturale abbondante. SCARSA = poco luminoso.' }}>
                    Luminosità *
                  </Label>
                  <select value={val.luminosita} onChange={e => upd('luminosita', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                    <option value="SCARSA">SCARSA</option>
                    <option value="BUONA">BUONA</option>
                    <option value="OTTIMA">OTTIMA</option>
                  </select>
                </div>
                <div>
                  <Label info={{ titolo: 'Stato Conservazione', testo: 'OTTIMO = nuovo/ristrutturato. SCADENTE = da ristrutturare.' }}>
                    Stato Conservazione *
                  </Label>
                  <select value={val.stato_conservazione} onChange={e => upd('stato_conservazione', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                    <option value="SCADENTE">SCADENTE (Da ristrutturare)</option>
                    <option value="NORMALE">NORMALE (Abitabile)</option>
                    <option value="OTTIMO">OTTIMO (Nuovo/Ristrutturato)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── SUPERFICI ESTERNE E BOX (collassabile) ── */}
            <details style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <summary style={{
                padding: '14px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
                userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 12, opacity: 0.6 }}>▶</span>
                Superfici Esterne e Comparabili
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                  (balcone, terrazza, giardino, box, comparabili manuali)
                </span>
              </summary>
              <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <Label info={{ titolo: 'Box / Posto Auto', testo: 'Valore aggiunto: posto auto +€5k, box singolo +€12k, box doppio +€20k.' }}>
                      Box / Posto Auto
                    </Label>
                    <select value={val.box_dimensione} onChange={e => upd('box_dimensione', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                      <option value="nessuno">Nessuno</option>
                      <option value="posto_auto">Posto auto scoperto</option>
                      <option value="singolo">Box singolo</option>
                      <option value="doppio">Box doppio</option>
                    </select>
                  </div>
                  <div>
                    <Label info={{ titolo: 'Numero di Balconi', testo: 'Ogni balcone vale circa 7 mq × 30% del prezzo/mq dell\'immobile.' }}>Numero di Balconi</Label>
                    <input type="number" min="0" max="10" step="1" placeholder="Es: 2" value={val.num_balconi}
                      onChange={e => upd('num_balconi', Math.min(10, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  </div>
                  <div>
                    <Label info={{ titolo: 'Terrazza (mq)', testo: 'Vale il 50% del prezzo/mq dell\'immobile.' }}>Terrazza (mq)</Label>
                    <input type="number" min="0" step="1" value={val.terrazza_mq}
                      onChange={e => upd('terrazza_mq', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  </div>
                  <div>
                    <Label info={{ titolo: 'Giardino esclusivo (mq)', testo: 'Vale il 20% del prezzo/mq dell\'immobile.' }}>Giardino (mq)</Label>
                    <input type="number" min="0" step="1" value={val.giardino_mq}
                      onChange={e => upd('giardino_mq', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  </div>
                </div>

                {/* Comparabili manuali */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Comparabili Reali <span style={{ fontWeight: 400, textTransform: 'none' }}>(opzionale — fino a 3 vendite simili recenti)</span>
                  </p>
                  {val.comparabili_manuali.map((comp, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-3 mb-2">
                      <input type="number" placeholder="Superficie (mq)" value={comp.superficie || ''}
                        onChange={e => {
                          const arr = [...val.comparabili_manuali];
                          arr[idx] = { ...arr[idx], superficie: parseFloat(e.target.value) || 0 };
                          upd('comparabili_manuali', arr);
                        }}
                        className="px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                      <input type="number" placeholder="Prezzo totale (€)" value={comp.prezzo || ''}
                        onChange={e => {
                          const arr = [...val.comparabili_manuali];
                          arr[idx] = { ...arr[idx], prezzo: parseFloat(e.target.value) || 0 };
                          upd('comparabili_manuali', arr);
                        }}
                        className="px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                      <div className="flex gap-2 items-center">
                        {comp.superficie > 0 && comp.prezzo > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--success)' }}>
                            {formatEuro(Math.round(comp.prezzo / comp.superficie))}/mq
                          </span>
                        )}
                        <button type="button"
                          onClick={() => upd('comparabili_manuali', val.comparabili_manuali.filter((_, i) => i !== idx))}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}>
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {val.comparabili_manuali.length < 3 && (
                    <button type="button"
                      onClick={() => upd('comparabili_manuali', [...val.comparabili_manuali, { superficie: '', prezzo: '' }])}
                      style={{ padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
                      + Aggiungi comparabile
                    </button>
                  )}
                  {val.comparabili_manuali.filter(c => c.superficie > 0 && c.prezzo > 0).length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
                      ✓ {val.comparabili_manuali.filter(c => c.superficie > 0 && c.prezzo > 0).length} comparabile/i inserit/i — peso 50% con stima OMI
                    </p>
                  )}
                </div>
              </div>
            </details>

            {/* Bottoni separati dal form con bordo e margine — gerarchia visiva chiara */}
            <div className="flex justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setStepAttivo(0)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                ← Indietro
              </button>
              <button
                onClick={() => setStepAttivo(2)}
                disabled={!val.indirizzo || !val.zona_codice || !val.tipologia || !val.superficie_mq || !val.stato_immobile}
                className="disabled:opacity-40"
                style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 2 - PREZZO REALE                                       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 2 && (() => {
          const zonaSelezionata = zone.find(z => z.link_zona === val.zona_codice);
          const prezzoNum = parsePrezzoNumerico(val.prezzo_dichiarato);
          const mqNum = parseFloat(val.superficie_mq) || 0;
          const prezzoMq = prezzoNum && mqNum > 0 ? Math.round(prezzoNum / mqNum) : null;
          const omiMin = zonaSelezionata?.compr_min ?? null;
          const omiMax = zonaSelezionata?.compr_max ?? null;
          const omiLocMin = zonaSelezionata?.loc_min ?? null;
          const omiLocMax = zonaSelezionata?.loc_max ?? null;

          let omiBadge = null;
          if (prezzoMq && omiMin && omiMax) {
            if (prezzoMq < omiMin) {
              omiBadge = { icon: '💡', color: '#3b82f6', testo: 'Sotto media OMI zona' };
            } else if (prezzoMq > omiMax) {
              omiBadge = { icon: '⚠', color: 'var(--warning)', testo: 'Sopra media OMI zona' };
            } else {
              omiBadge = { icon: '✓', color: 'var(--success)', testo: 'In linea con il range OMI' };
            }
          }

          return (
            <div className="flex flex-col gap-7">
              <div style={{ paddingBottom: 8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>
                  Prezzo Reale dell'Immobile
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Inserisci il prezzo reale che conosci — da perizia, agenzia o annuncio.
                  Il software non stima il valore: lo usi tu per l'analisi finanziaria.
                </p>
              </div>

              {/* Campo prezzo principale */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label>Prezzo immobile (€) *</Label>
                  <input
                    type="text" inputMode="decimal"
                    value={val.prezzo_dichiarato ?? ''}
                    onChange={e => upd('prezzo_dichiarato', e.target.value)}
                    placeholder="Es. 170.000"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      ...inputStyle,
                      fontSize: 16, fontWeight: 600,
                      borderColor: !val.prezzo_dichiarato ? 'rgba(245,158,11,0.6)' : 'var(--border)',
                    }}
                  />
                  {prezzoMq && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      = <strong style={{ color: 'var(--text-primary)' }}>{formatEuro(prezzoMq)}/mq</strong>
                      {omiBadge && (
                        <span style={{ marginLeft: 8, color: omiBadge.color, fontWeight: 600 }}>
                          {omiBadge.icon} {omiBadge.testo}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Fonte del prezzo *</Label>
                  <select
                    value={val.fonte_prezzo ?? ''}
                    onChange={e => upd('fonte_prezzo', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  >
                    <option value="">Seleziona fonte...</option>
                    <option value="perizia">Perizia professionale</option>
                    <option value="agenzia">Proposta agenzia immobiliare</option>
                    <option value="annuncio">Annuncio immobiliare</option>
                    <option value="stima">Stima personale</option>
                  </select>
                </div>
              </div>

              {/* Note sul prezzo */}
              <div>
                <Label>Note sul prezzo <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>(opzionale)</span></Label>
                <input
                  type="text"
                  value={val.note_prezzo ?? ''}
                  onChange={e => upd('note_prezzo', e.target.value)}
                  placeholder="Es: perizia del 15/03/2025, notaio Rossi..."
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>

              {/* Pannello riferimenti OMI */}
              {zonaSelezionata && (
                <div style={{
                  borderRadius: 12,
                  border: '1px dashed rgba(100,116,139,0.4)',
                  background: 'rgba(100,116,139,0.04)',
                  padding: '16px 20px',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                    📊 Prezzi di riferimento OMI — {zonaNome}
                  </p>

                  <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Compravendita</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {omiMin && omiMax ? `${formatEuro(omiMin)}/mq — ${formatEuro(omiMax)}/mq` : 'Non disponibile'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Locazione</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {omiLocMin && omiLocMax ? `${formatEuro(omiLocMin)}/mq — ${formatEuro(omiLocMax)}/mq` : 'Non disponibile'}
                      </p>
                    </div>
                  </div>

                  {/* Confronto visivo se prezzo inserito */}
                  {prezzoMq && omiMin && omiMax && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Il tuo prezzo ({formatEuro(prezzoMq)}/mq) rispetto al range OMI:
                      </p>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-hover)', position: 'relative', overflow: 'visible', marginBottom: 4 }}>
                        <div style={{ position: 'absolute', left: '10%', right: '10%', height: '100%', background: 'rgba(100,116,139,0.3)', borderRadius: 4 }} />
                        {(() => {
                          const rangeVis = omiMax * 1.3;
                          const pct = Math.min(95, Math.max(5, (prezzoMq / rangeVis) * 100));
                          return (
                            <div style={{
                              position: 'absolute', left: `${pct}%`, top: -3,
                              width: 14, height: 14, borderRadius: '50%',
                              background: omiBadge?.color ?? 'var(--accent)',
                              border: '2px solid var(--bg-card)', transform: 'translateX(-50%)',
                            }} />
                          );
                        })()}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                        <span>{formatEuro(omiMin)}/mq</span>
                        <span style={{ color: omiBadge?.color, fontWeight: 700 }}>{omiBadge?.icon} {omiBadge?.testo}</span>
                        <span>{formatEuro(omiMax)}/mq</span>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px dashed rgba(100,116,139,0.3)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    ⚠ I dati OMI sono fasce statistiche ufficiali dell'Agenzia delle Entrate e rappresentano una media di zona.
                    Il valore reale può differire significativamente. Forniti a titolo puramente indicativo.
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3" style={{ paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setStepAttivo(1)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  ← Indietro
                </button>
                <button
                  onClick={() => setStepAttivo(3)}
                  disabled={!val.prezzo_dichiarato || !val.fonte_prezzo}
                  className="disabled:opacity-40"
                  style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  Avanti →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 3 - PARAMETRI (sezioni dinamiche per ogni metodo)     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 3 && (() => {
          const haRED = val.metodiSelezionati.includes('REDDITUALE');
          const haDCF = val.metodiSelezionati.includes('DCF');
          const needsRental = haRED || haDCF;
          const needsDcfOnly = haDCF && !haRED; // DCF selezionato ma RED no

          // Il pulsante calcola è abilitato solo se i campi obbligatori sono presenti
          const canCalcola = (
            // Se RED o DCF → canone obbligatorio
            (!needsRental || val.canone_mensile) &&
            // Se DCF → prezzo acquisto obbligatorio
            (!haDCF || val.prezzo_acquisto)
          );

          return (
            <div className="flex flex-col gap-7">
              <div style={{ paddingBottom: 4 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>
                  Inserisci i Parametri
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Scegli il tipo di analisi da eseguire sul prezzo che hai inserito.
                </p>
              </div>

              {/* ── Selezione tipo analisi ── */}
              <div className="flex flex-col gap-3">
                {[
                  {
                    id: 'REDDITUALE',
                    titolo: 'Solo Analisi Reddituale',
                    badge: 'RED',
                    badgeColor: '#3b82f6',
                    badgeText: '#fff',
                    desc: 'Calcola rendimento lordo e netto sul prezzo reale che hai inserito. Ideale per valutare la convenienza di un affitto.',
                    metodi: ['REDDITUALE'],
                  },
                  {
                    id: 'FINANZIARIA_COMPLETA',
                    titolo: 'Analisi Reddituale + Finanziaria Completa',
                    badge: 'RED + DCF',
                    badgeColor: 'var(--success)',
                    badgeText: '#fff',
                    desc: 'Rendimento + proiezione pluriennale con VAN, TIR, ROI, mutuo e sensitivity analysis sull\'orizzonte di investimento.',
                    metodi: ['REDDITUALE', 'DCF'],
                  },
                ].map(opt => {
                  const sel = val.tipoValutazione === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        upd('tipoValutazione', opt.id);
                        upd('metodiSelezionati', opt.metodi);
                      }}
                      style={{
                        textAlign: 'left', padding: '18px 20px', borderRadius: 12,
                        border: `2px solid ${sel ? opt.badgeColor : 'var(--border)'}`,
                        background: sel
                          ? opt.id === 'REDDITUALE' ? 'rgba(59,130,246,0.05)' : 'rgba(16,185,129,0.05)'
                          : 'var(--bg-secondary)',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${sel ? opt.badgeColor : 'var(--border)'}`,
                          background: sel ? opt.badgeColor : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {sel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                          padding: '3px 8px', borderRadius: 6,
                          background: sel ? opt.badgeColor : 'var(--bg-hover)',
                          color: sel ? opt.badgeText : 'var(--text-muted)',
                        }}>
                          {opt.badge}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: sel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {opt.titolo}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: 30 }}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* ── SEZIONE REDDITUALE (se RED o DCF selezionati) ── */}
              {needsRental && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ width: 3, height: 16, borderRadius: 2, background: '#3b82f6', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3b82f6' }}>
                      {haRED ? 'Reddituale — Dati di Locazione' : 'Dati di Locazione (richiesti per DCF)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" style={{ marginBottom: 16 }}>
                    <div>
                      <Label info={{ titolo: 'Canone Mensile Lordo', testo: 'Affitto mensile lordo in €, prima di vacancy e spese.' }}>
                        Canone Mensile Lordo (€) *
                      </Label>
                      <input type="number" value={val.canone_mensile} onChange={e => upd('canone_mensile', e.target.value)}
                        placeholder="Es. 800" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    {haRED && (
                      <div>
                        <Label info={{ titolo: 'Cap Rate %', testo: 'Tasso di capitalizzazione: Valore = NOI / Cap Rate. Tipico 4-7%.' }}>
                          Cap Rate % *
                        </Label>
                        <input type="number" step="0.1" value={val.cap_rate_pct} onChange={e => upd('cap_rate_pct', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                      </div>
                    )}
                  </div>
                  {/* Tipo locazione */}
                  <div style={{ marginBottom: 8 }}>
                    <Label info={{ titolo: 'Tipo Locazione', testo: '4+4 libero: tassazione ordinaria o cedolare 21%. 3+2 concordato: cedolare 10%. Breve turistico: occupazione tipica 40-70%, gestione 20-30%.' }}>
                      Tipo di Locazione
                    </Label>
                    <select value={val.tipo_locazione} onChange={e => upd('tipo_locazione', e.target.value)}
                      className="w-full max-w-xs px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                      <option value="lunga_libero">Lunga 4+4 – Libero</option>
                      <option value="lunga_concordato">Lunga 3+2 – Concordato (cedolare 10%)</option>
                      <option value="transitoria">Transitoria 1-18 mesi</option>
                      <option value="studenti">Studenti universitari</option>
                      <option value="breve_turistico">Breve/Turistico (Airbnb)</option>
                    </select>
                    {val.tipo_locazione === 'breve_turistico' && (
                      <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                        ⚠ Locazione breve: occupazione tipica 40-70%, gestione 20-30% del fatturato
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <div>
                      <Label info={{ titolo: 'Vacancy %', testo: '% di tempo sfitto annuo. Tipico 5-10%.' }}>Vacancy %</Label>
                      <input type="number" step="0.5" value={val.vacancy_pct} onChange={e => upd('vacancy_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Spese Annue (€)', testo: 'Se preferisci un importo unico invece del breakdown. Il breakdown qui sotto ha precedenza se compilato.' }}>
                        Spese Annue totali (€) <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(o usa breakdown)</span>
                      </Label>
                      <input type="number" value={val.spese_annue} onChange={e => upd('spese_annue', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    {/* Prezzo acquisto: opzionale se solo RED, non mostrato se DCF (sarà richiesto nella sezione DCF) */}
                    {haRED && !haDCF && (
                      <div>
                        <Label info={{ titolo: 'Prezzo Acquisto (€)', testo: 'Opzionale. Usato per calcolare il rendimento lordo/netto sul prezzo reale pagato.' }}>
                          Prezzo Acquisto <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opz.)</span>
                        </Label>
                        <input type="text" inputMode="decimal" value={val.prezzo_acquisto} onChange={e => upd('prezzo_acquisto', e.target.value)}
                          placeholder="Es. 200.000" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                      </div>
                    )}
                  </div>

                  {/* Breakdown spese dettagliato */}
                  <details style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 4 }}>
                    <summary style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-secondary)', userSelect: 'none', listStyle: 'none' }}>
                      ▶ Breakdown spese dettagliato (opzionale — ha precedenza su "Spese Annue totali")
                    </summary>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ padding: '14px 14px' }}>
                      {[
                        { key: 'spese_imu',           label: 'IMU annua (€)',        info: 'Rendita catastale × 1.05 × 160 × aliquota. Esente prima casa.' },
                        { key: 'spese_condominio',    label: 'Condominio annuo (€)', info: 'Quota proprietario. Tipico €30-100/mese.' },
                        { key: 'spese_manutenzione',  label: 'Manutenzione (€)',      info: 'Riserva manutenzione ordinaria. Tipico 1-2% del valore immobile/anno.' },
                        { key: 'spese_assicurazione', label: 'Assicurazione (€)',     info: 'Polizza fabbricato. Tipico €150-400/anno.' },
                        { key: 'spese_gestione',      label: 'Gestione/Agenzia (€)', info: 'Property management 8-12% del canone o agenzia.' },
                        { key: 'spese_altre',         label: 'Altre spese (€)',       info: 'TARI, utenze a carico proprietario, ecc.' },
                      ].map(({ key, label, info }) => (
                        <div key={key}>
                          <Label info={{ titolo: label, testo: info }}>{label}</Label>
                          <input type="number" value={val[key]} onChange={e => upd(key, e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const tot = ['spese_imu','spese_condominio','spese_manutenzione','spese_assicurazione','spese_gestione','spese_altre']
                        .reduce((s, k) => s + (parseFloat(val[k])||0), 0);
                      const canoneAnnuo = parseFloat(val.canone_mensile||0) * 12;
                      const pct = canoneAnnuo > 0 ? (tot / canoneAnnuo * 100) : 0;
                      return tot > 0 ? (
                        <div style={{ padding: '8px 14px 12px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                          Totale spese breakdown: <strong style={{ color: pct > 35 ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {formatEuro(tot)}
                          </strong>
                          {canoneAnnuo > 0 && ` · incidenza ${pct.toFixed(1)}% sul canone`}
                          {pct > 35 && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>⚠ sopra la media (tipico 20-35%)</span>}
                        </div>
                      ) : null;
                    })()}
                  </details>
                </div>
              )}

              {/* ── SEZIONE DCF (solo se DCF selezionato) ── */}
              {haDCF && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--success)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--success)' }}>
                      DCF — Analisi Finanziaria
                    </span>
                  </div>

                  {/* Prezzo acquisto — obbligatorio per DCF */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" style={{ marginBottom: 16 }}>
                    <div>
                      <Label info={{ titolo: 'Prezzo di Acquisto', testo: 'Prezzo pagato per l\'immobile in €. Formato italiano: 200.000 (punto = migliaia).' }}>
                        Prezzo Acquisto (€) *
                      </Label>
                      <input type="text" inputMode="decimal" value={val.prezzo_acquisto || val.prezzo_dichiarato || ''}
                        onChange={e => upd('prezzo_acquisto', e.target.value)}
                        placeholder="Es. 200.000" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    {needsDcfOnly && (
                      <div>
                        <Label info={{ titolo: 'Canone Mensile Lordo', testo: 'Affitto mensile lordo in € prima di vacancy e spese.' }}>
                          Canone Mensile (€) *
                        </Label>
                        <input type="number" value={val.canone_mensile} onChange={e => upd('canone_mensile', e.target.value)}
                          placeholder="Es. 800" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                      </div>
                    )}
                  </div>

                  {/* Parametri operativi DCF */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" style={{ marginBottom: 20 }}>
                    <div>
                      <Label info={{ titolo: 'Costi Acquisto %', testo: 'Notaio, imposte, agenzia. Tipicamente 8-12%.' }}>Costi Acquisto %</Label>
                      <input type="number" step="0.5" value={val.costi_acquisto_pct} onChange={e => upd('costi_acquisto_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Cap Rate Exit %', testo: 'Cap rate usato per calcolare il valore di rivendita finale. Tipico 4-7%.' }}>Cap Rate Exit %</Label>
                      <input type="number" step="0.1" value={val.cap_rate_exit_pct} onChange={e => upd('cap_rate_exit_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    {needsDcfOnly && (
                      <>
                        <div>
                          <Label info={{ titolo: 'Vacancy %', testo: '% tempo sfitto annuo. Tipico 5-10%.' }}>Vacancy %</Label>
                          <input type="number" step="0.5" value={val.vacancy_pct} onChange={e => upd('vacancy_pct', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                        </div>
                        <div>
                          <Label info={{ titolo: 'Spese Annue (€)', testo: 'IMU, condominio, TARI, gestione, manutenzione.' }}>Spese Annue (€)</Label>
                          <input type="number" value={val.spese_annue} onChange={e => upd('spese_annue', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Finanziamento */}
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Finanziamento</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" style={{ marginBottom: 20 }}>
                    <div>
                      <Label info={{ titolo: 'LTV %', testo: '% del prezzo finanziata dalla banca. 0% = acquisto cash.' }}>LTV %</Label>
                      <input type="number" step="5" value={val.ltv_pct} onChange={e => upd('ltv_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Tasso Mutuo %', testo: 'Tasso interesse annuo del mutuo.' }}>Tasso Mutuo %</Label>
                      <input type="number" step="0.1" value={val.tasso_mutuo_pct} onChange={e => upd('tasso_mutuo_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Durata Mutuo', testo: 'Anni del piano di ammortamento. Tipico: 20-30 anni.' }}>Durata Anni</Label>
                      <input type="number" value={val.durata_mutuo_anni} onChange={e => upd('durata_mutuo_anni', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Orizzonte Temporale', testo: 'Anni di detenzione prima della rivendita. Tipico 5-10.' }}>Orizzonte Anni</Label>
                      <input type="number" min="1" max="20" value={val.orizzonte_anni} onChange={e => upd('orizzonte_anni', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                  </div>

                  {/* Parametri avanzati DCF */}
                  <p className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Parametri Avanzati</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    <div>
                      <Label info={{ titolo: 'Costi Vendita % all\'Exit', testo: 'Agenzia 2-4% + eventuali tasse. Tipico totale 3-5%. Ora parametrizzabile.' }}>
                        Costi Vendita Exit %
                      </Label>
                      <input type="number" step="0.5" min="0" max="15" value={val.costi_vendita_pct}
                        onChange={e => upd('costi_vendita_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Costi Ristrutturazione (€)', testo: 'Lavori iniziali da fare. Vengono aggiunti al capitale investito.' }}>Costi Ristrutturazione (€)</Label>
                      <input type="number" value={val.costi_ristrutturazione} onChange={e => upd('costi_ristrutturazione', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Crescita NOI %/anno', testo: 'Crescita annua dei canoni. Tipico 1.5-3%.' }}>Crescita NOI %/anno</Label>
                      <input type="number" step="0.1" value={val.tasso_crescita_noi_pct} onChange={e => upd('tasso_crescita_noi_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                    <div>
                      <Label info={{ titolo: 'Tasso Attualizzazione %', testo: 'Rendimento minimo richiesto (hurdle rate). VAN > 0 = investimento batte questo tasso. Tipico 6-10%.' }}>Tasso Attualizzazione %</Label>
                      <input type="number" step="0.1" value={val.tasso_attualizzazione_pct} onChange={e => upd('tasso_attualizzazione_pct', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}


              <div className="flex justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setStepAttivo(2)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  ← Indietro
                </button>
                <button
                  onClick={eseguiAnalisi}
                  disabled={loading || !canCalcola}
                  className="disabled:opacity-40"
                  style={{
                    padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: haDCF ? 'var(--success)' : haRED ? '#3b82f6' : 'var(--accent)',
                    color: haDCF || haRED ? '#fff' : '#000',
                  }}
                >
                  {loading ? 'Calcolo in corso...' : `Calcola ${val.metodiSelezionati.join(' + ')} →`}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* STEP 4 - RISULTATI FINALI                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stepAttivo === 4 && (
          <div className="flex flex-col gap-7">
            <div style={{ paddingBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>Risultati Valutazione</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {val.indirizzo || 'Immobile'} · {val.superficie_mq} mq · {val.tipologia}
              </p>
            </div>

            {/* ── Riepilogo Immobile Analizzato ─────────────────────────── */}
            {(() => {
              const zonaSelRiepilogo = zone.find(z => z.link_zona === val.zona_codice);
              const prezzoNumRiep = parsePrezzoNumerico(val.prezzo_dichiarato);
              const mqNumRiep = parseFloat(val.superficie_mq) || 0;
              const prezzoMqRiep = prezzoNumRiep && mqNumRiep > 0 ? Math.round(prezzoNumRiep / mqNumRiep) : null;
              const omiMinRiep = zonaSelRiepilogo?.compr_min ?? null;
              const omiMaxRiep = zonaSelRiepilogo?.compr_max ?? null;
              let omiBadgeRiep = null;
              if (prezzoMqRiep && omiMinRiep && omiMaxRiep) {
                if (prezzoMqRiep < omiMinRiep)       omiBadgeRiep = { icon: '💡', color: '#3b82f6', testo: 'Sotto media OMI' };
                else if (prezzoMqRiep > omiMaxRiep)  omiBadgeRiep = { icon: '⚠', color: 'var(--warning)', testo: 'Sopra media OMI' };
                else                                  omiBadgeRiep = { icon: '✓', color: 'var(--success)', testo: 'In linea OMI' };
              }
              const fonteLabel = { perizia: 'Perizia professionale', agenzia: 'Proposta agenzia', annuncio: 'Annuncio immobiliare', stima: 'Stima personale' }[val.fonte_prezzo] ?? val.fonte_prezzo;
              return (
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.06)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      Immobile Analizzato
                    </p>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px 20px' }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Indirizzo</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{val.indirizzo || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Zona</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{zonaNome || '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Superficie</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{mqNumRiep > 0 ? `${mqNumRiep} mq` : '—'}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Prezzo dichiarato</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{prezzoNumRiep ? formatEuro(prezzoNumRiep) : '—'}</p>
                    </div>
                    {prezzoMqRiep && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Prezzo/mq</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatEuro(prezzoMqRiep)}/mq
                          {omiBadgeRiep && <span style={{ marginLeft: 6, fontSize: 11, color: omiBadgeRiep.color }}>{omiBadgeRiep.icon} {omiBadgeRiep.testo}</span>}
                        </p>
                      </div>
                    )}
                    {fonteLabel && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Fonte prezzo</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fonteLabel}</p>
                      </div>
                    )}
                    {omiMinRiep && omiMaxRiep && (
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Range OMI zona</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatEuro(omiMinRiep)} — {formatEuro(omiMaxRiep)}/mq</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Pannello: come leggere i risultati ─────────────────────── */}
            <div style={{ borderRadius: 12, padding: '16px 20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Come leggere i risultati</p>
              <ul style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.9, margin: 0, paddingLeft: 16 }}>
                  {val.reddituale && <>
                  <li><strong style={{ color: '#3b82f6' }}>Reddituale — Valore di Mercato</strong> — NOI annuo / Cap Rate. Es.: NOI €9.600 con Cap Rate 5% → €192.000.</li>
                  <li><strong style={{ color: '#3b82f6' }}>Rendimento Lordo/Netto</strong> — calcolati sul prezzo di acquisto (se inserito).</li>
                </>}
                {val.dcf && <>
                  <li><strong style={{ color: 'var(--success)' }}>DCF — VAN</strong> — positivo = l'investimento crea valore al tasso del {val.tasso_attualizzazione_pct}% richiesto.</li>
                  <li><strong style={{ color: 'var(--success)' }}>TIR</strong> — TIR &gt; {val.tasso_attualizzazione_pct}% → investimento conveniente sul orizzonte {val.orizzonte_anni} anni.</li>
                  <li><strong style={{ color: 'var(--success)' }}>ROI / Cash-on-Cash</strong> — rendimento totale sull'equity / rendimento nel 1° anno operativo.</li>
                </>}
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>


              {/* ── Reddituale ───────────────────────────────────────────── */}
              {val.reddituale && (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3b82f6', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3b82f6' }}>
                      Analisi Reddituale
                    </span>
                  </div>
                  <div style={{ padding: '20px 24px 16px' }}>
                    {/* Valore mercato in evidenza */}
                    <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Valore di Mercato</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{formatEuro(val.reddituale.valore_mercato)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <RigaKPI label="NOI Annuo" valore={formatEuro(val.reddituale.noi_annuo)} />
                      <RigaKPI label="Reddito Effettivo" valore={formatEuro(val.reddituale.reddito_effettivo ?? val.reddituale.reddito_effettivo_annuo)} />
                      <RigaKPI label="Rendimento Lordo" valore={val.reddituale.rendimento_lordo_pct != null ? formatPct(val.reddituale.rendimento_lordo_pct) : '—'} colore="var(--success)" />
                      <RigaKPI label="Rendimento Netto" valore={val.reddituale.rendimento_netto_pct != null ? formatPct(val.reddituale.rendimento_netto_pct) : '—'} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── DCF ─────────────────────────────────────────────────── */}
              {val.dcf && (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--success)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--success)' }}>
                      Analisi DCF — Orizzonte {val.orizzonte_anni} anni
                    </span>
                  </div>

                  {/* 4 KPI box */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'VAN (NPV)',     v: formatEuro(val.dcf.van),             ok: val.dcf.van > 0 },
                      { label: 'TIR (IRR)',     v: formatPct(val.dcf.tir_pct),          ok: val.dcf.tir_pct > val.tasso_attualizzazione_pct },
                      { label: 'ROI Totale',   v: formatPct(val.dcf.roi_totale_pct),    ok: true },
                      { label: 'Cash-on-Cash', v: formatPct(val.dcf.cash_on_cash_pct),  ok: val.dcf.cash_on_cash_pct > 0 },
                    ].map((kpi, i) => (
                      <div
                        key={kpi.label}
                        style={{
                          padding: '22px 16px', textAlign: 'center',
                          borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.03em' }}>{kpi.label}</p>
                        <p style={{ fontSize: 20, fontWeight: 700, color: kpi.ok ? 'var(--success)' : 'var(--danger)' }}>{kpi.v}</p>
                      </div>
                    ))}
                  </div>

                  {/* metriche secondarie */}
                  <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, borderBottom: '1px solid var(--border)' }}>
                    <RigaKPI label="Equity investita"    valore={formatEuro(val.dcf.equity)} />
                    <RigaKPI label="Rata mensile mutuo"  valore={val.dcf.rata_mensile ? formatEuro(val.dcf.rata_mensile) : 'No mutuo'} />
                    <RigaKPI label="Valore rivendita lordo" valore={formatEuro(val.dcf.valore_rivendita_finale)} />
                    <RigaKPI label="Costi vendita (3%)"  valore={formatEuro(val.dcf.costi_vendita)} />
                    <RigaKPI label="Debito residuo"      valore={formatEuro(val.dcf.debito_residuo_finale)} />
                    <RigaKPI label="Incasso netto exit"  valore={formatEuro(val.dcf.incasso_netto_finale)} highlight />
                  </div>

                  {/* Sensitivity Analysis */}
                  {val.dcf?.sensitivity && (() => {
                    const { cap_values, crescita_values, matrice } = val.dcf.sensitivity;
                    const soglia = parseFloat(val.tasso_attualizzazione_pct);
                    return (
                      <div style={{ padding: '0 24px 16px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Analisi Sensibilità — TIR (%) per Cap Rate Exit × Crescita NOI
                        </p>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                  Cap Exit \ Crescita NOI
                                </th>
                                {crescita_values.map(c => (
                                  <th key={c} style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                    {c}%
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {cap_values.map((cap, ri) => (
                                <tr key={cap}>
                                  <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                    {cap}%
                                  </td>
                                  {(matrice[ri] || []).map((tir, ci) => (
                                    <td key={ci} style={{
                                      padding: '6px 10px', textAlign: 'center', fontWeight: 600, fontSize: 12,
                                      borderBottom: '1px solid var(--border)',
                                      background: tir >= soglia ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                      color: tir >= soglia ? 'var(--success)' : 'var(--danger)',
                                    }}>
                                      {typeof tir === 'number' ? tir.toFixed(1) : '–'}%
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                          Verde: TIR ≥ tasso attualizzazione richiesto ({soglia}%). Rosso: sotto soglia.
                        </p>
                      </div>
                    );
                  })()}

                  {/* verdetto */}
                  <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18 }}>
                      {val.dcf.investimento_conveniente ? '✓' : '⚠'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: val.dcf.investimento_conveniente ? 'var(--success)' : 'var(--danger)' }}>
                      {val.dcf.investimento_conveniente
                        ? `VAN positivo: l'investimento crea valore al tasso del ${val.tasso_attualizzazione_pct}% richiesto`
                        : `VAN negativo: l'investimento non raggiunge il rendimento del ${val.tasso_attualizzazione_pct}% richiesto`}
                    </span>
                  </div>
                </div>
              )}
            </div>


            {/* ── Confronto investimenti alternativi ──────────────────────── */}
            {(val.reddituale || val.dcf) && (() => {
              const anni = 10;
              const equity = val.dcf?.equity ?? parsePrezzoNumerico(val.prezzo_dichiarato) ?? 0;
              if (!equity) return null;

              // Rendimento netto immobile: preferisce DCF cash-on-cash, fallback reddituale netto
              const rendNettoImmobile = val.dcf?.cash_on_cash_pct
                ?? val.reddituale?.rendimento_netto_pct
                ?? 0;

              // Crescita composta: capitale × (1 + r)^anni
              const componi = (capitale, tassoPct) => capitale * Math.pow(1 + tassoPct / 100, anni);

              const ALTERNATIVE = [
                { label: 'Immobile',      tasso: rendNettoImmobile, colore: 'var(--accent)',   bold: true },
                { label: 'BTP 10 anni',   tasso: 3.6,               colore: '#3b82f6',          bold: false },
                { label: 'ETF Globale',   tasso: 7.0,               colore: 'var(--success)',   bold: false },
                { label: 'Conto Deposito',tasso: 4.0,               colore: 'var(--text-muted)',bold: false },
              ];

              const massimo = Math.max(...ALTERNATIVE.map(a => componi(equity, a.tasso)));

              return (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
                      Confronto Investimenti Alternativi — {anni} anni
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                      Capitale iniziale: {formatEuro(equity)}
                    </span>
                  </div>
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {ALTERNATIVE.map(alt => {
                      const finale = componi(equity, alt.tasso);
                      const guadagno = finale - equity;
                      const barPct = massimo > 0 ? (finale / massimo) * 100 : 0;
                      return (
                        <div key={alt.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: alt.bold ? 700 : 500, color: alt.bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {alt.label}
                            </span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: alt.colore }}>{formatEuro(Math.round(finale))}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                                +{formatEuro(Math.round(guadagno))} · {alt.tasso.toFixed(1)}%/anno
                              </span>
                            </div>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${barPct}%`, background: alt.colore, borderRadius: 3, transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                      Simulazione indicativa con crescita composta. BTP e Conto Deposito: rendimento lordo di mercato attuale.
                      ETF Globale: media storica MSCI World netta ~7%. Immobile: rendimento netto inserito (cash-on-cash se DCF, altrimenti reddituale netto).
                      Non considera fiscalità, inflazione, costi di gestione reali.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Azioni */}
            <div className="flex flex-col sm:flex-row justify-between gap-3" style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setStepAttivo(3)} style={{ padding: '12px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                ← Modifica
              </button>
              <button
                onClick={salvaRisultati}
                disabled={loading}
                className="disabled:opacity-40"
                style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                {loading ? 'Salvataggio...' : 'Aggiungi al Portafoglio'}
              </button>
            </div>
          </div>
        )}

        </div>{/* fine ZONA 2 form */}
      </div>{/* fine card wizard */}
    </div>
  );
}
