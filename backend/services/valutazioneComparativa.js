/**
 * SERVICE: Valutazione Comparativa di Mercato (VCM) — v3
 *
 * Logica:
 *   1. Calcola la Fascia OMI (BASSA/MEDIA/ALTA) da 6 caratteristiche a 3 livelli
 *   2. Recupera valori OMI aggiornati per zona/tipologia
 *   3. Seleziona prezzo base (compr_min/medio/max) in base alla fascia
 *   4. Applica coefficienti correttivi (piano, stato conservazione, dotazioni)
 *   5. Aggiunge bonus superfici esterne e box auto
 *   6. Se presenti comparabili manuali, media 50% con stima OMI
 *   7. Moltiplica per superficie → range min/medio/max (spread ±8% UNI 11558)
 */

const { pool } = require('../config/db');

// ─── Coefficienti per piano (con ascensore) ───────────────────────────────────
const COEFF_PIANO_CON_ASC = {
  0: 0.90,
  1: 0.97,
  2: 1.00,
  3: 1.03,
  4: 1.04,
  5: 1.02,
};

// ─── Coefficienti per piano (senza ascensore) ─────────────────────────────────
const COEFF_PIANO_SENZA_ASC = {
  0: 0.90,
  1: 0.95,
  2: 1.00,
  3: 0.97,
  4: 0.93,
  5: 0.88,
};

// ─── Coefficienti stato conservativo (3 livelli) ──────────────────────────────
const COEFF_STATO = {
  OTTIMO:   1.08,
  NORMALE:  1.00,
  SCADENTE: 0.88,
};

// ─── Coefficienti dotazioni (% aggiuntiva sul valore) ────────────────────────
const COEFF_DOTAZIONI = {
  ascensore:        0.03,
  box_auto:         0.05,
  balcone_terrazza: 0.02,
  cantina:          0.01,
};

// ─── Bonus box/posto auto in € fissi ──────────────────────────────────────────
const BONUS_BOX = {
  nessuno:    0,
  posto_auto: 5000,
  singolo:    12000,
  doppio:     20000,
};

/**
 * calcolaFasciaOMI — Determina la fascia OMI in base a 6 caratteristiche a 3 livelli.
 *
 * Ogni caratteristica nella sua variante "alta" vale 1 punto:
 *   classe_energetica ALTA, esposizione OTTIMA, vista PREGIATA,
 *   qualita_costruzione PREGIATA, luminosita OTTIMA, stato_conservazione OTTIMO
 *
 * Totale 0-6 puntiAlti:
 *   0-1 → BASSA  → usa compr_min OMI
 *   2-3 → MEDIA  → usa (compr_min + compr_max) / 2
 *   4-6 → ALTA   → usa compr_max OMI
 */
function calcolaFasciaOMI({ classe_energetica, esposizione, vista, qualita_costruzione, luminosita, stato_conservazione }) {
  let puntiAlti = 0;
  if (classe_energetica   === 'ALTA')     puntiAlti++;
  if (esposizione          === 'OTTIMA')   puntiAlti++;
  if (vista                === 'PREGIATA') puntiAlti++;
  if (qualita_costruzione  === 'PREGIATA') puntiAlti++;
  if (luminosita           === 'OTTIMA')   puntiAlti++;
  if (stato_conservazione  === 'OTTIMO')   puntiAlti++;

  let fascia;
  if (puntiAlti >= 4)      fascia = 'ALTA';
  else if (puntiAlti >= 2) fascia = 'MEDIA';
  else                     fascia = 'BASSA';

  return { fascia, puntiAlti };
}

/**
 * calcolaVCM — Calcola il valore di mercato tramite metodo comparativo OMI.
 *
 * @param {string}  zona_codice           Codice zona OMI (es. "D12")
 * @param {string}  tipologia             Tipologia immobile (es. "Abitazioni civili")
 * @param {string}  stato                 Legacy: NORMALE/OTTIMO/SCADENTE (fallback se stato_conservazione assente)
 * @param {number}  superficie_mq         Superficie commerciale in mq
 * @param {number}  piano                 Piano dell'immobile (0=terra)
 * @param {boolean} ascensore             Presenza ascensore
 * @param {boolean} box_auto              Box auto (legacy dotazione)
 * @param {boolean} balcone_terrazza      Balcone/terrazza (legacy dotazione)
 * @param {boolean} cantina               Cantina
 * @param {number|null} prezzo_base_override Sovrascrive prezzo OMI se fornito
 * @param {string}  classe_energetica     3 livelli: BASSA/MEDIA/ALTA
 * @param {string}  esposizione           3 livelli: SCARSA/BUONA/OTTIMA
 * @param {string}  vista                 3 livelli: COMUNE/STANDARD/PREGIATA
 * @param {string}  qualita_costruzione   3 livelli: ECONOMICA/STANDARD/PREGIATA
 * @param {string}  luminosita            3 livelli: SCARSA/BUONA/OTTIMA
 * @param {string}  stato_conservazione   3 livelli: SCADENTE/NORMALE/OTTIMO
 * @param {number}  balcone_mq            Superficie balcone (30% prezzo/mq)
 * @param {number}  terrazza_mq           Superficie terrazza (50% prezzo/mq)
 * @param {number}  giardino_mq           Giardino esclusivo (20% prezzo/mq)
 * @param {string}  box_dimensione        nessuno/posto_auto/singolo/doppio
 * @param {Array}   comparabili_manuali   [{superficie, prezzo}] vendite simili
 */
async function calcolaVCM({
  zona_codice,
  tipologia,
  stato,
  superficie_mq,
  piano = 1,
  ascensore = false,
  box_auto = false,
  balcone_terrazza = false,
  cantina = false,
  prezzo_base_override = null,
  classe_energetica = 'MEDIA',
  esposizione = 'BUONA',
  vista = 'STANDARD',
  qualita_costruzione = 'STANDARD',
  luminosita = 'BUONA',
  stato_conservazione = 'NORMALE',
  balcone_mq = 0,
  terrazza_mq = 0,
  giardino_mq = 0,
  box_dimensione = 'nessuno',
  comparabili_manuali = [],
}) {

  // ── Step 1: Fascia OMI ────────────────────────────────────────────────────
  const { fascia, puntiAlti } = calcolaFasciaOMI({
    classe_energetica, esposizione, vista, qualita_costruzione, luminosita, stato_conservazione,
  });

  // ── Step 2: Dati OMI dal database ────────────────────────────────────────
  const [righeOMI] = await pool.query(`
    SELECT compr_min, compr_max, loc_min, loc_max,
           descrizione_tipologia, stato, anno, semestre
    FROM omi_valori
    WHERE zona_codice = ?
      AND descrizione_tipologia LIKE ?
      AND stato = 'NORMALE'
      AND anno = (SELECT MAX(anno) FROM omi_valori)
      AND semestre = (
        SELECT MAX(semestre) FROM omi_valori
        WHERE anno = (SELECT MAX(anno) FROM omi_valori)
      )
    ORDER BY semestre DESC
    LIMIT 10
  `, [zona_codice, `%${tipologia}%`]);


  // ── Step 2b: Medie OMI compr_min / compr_max ─────────────────────────────
  const avg_compr_min = righeOMI.length > 0
    ? righeOMI.reduce((s, r) => s + parseFloat(r.compr_min), 0) / righeOMI.length
    : null;
  const avg_compr_max = righeOMI.length > 0
    ? righeOMI.reduce((s, r) => s + parseFloat(r.compr_max), 0) / righeOMI.length
    : null;

  // ── Step 3: Prezzo base al mq ─────────────────────────────────────────────
  let prezzo_base_mq;
  const numero_comparabili = righeOMI.length;

  if (prezzo_base_override) {
    prezzo_base_mq = prezzo_base_override;
  } else if (righeOMI.length > 0) {
    const prezziBase = righeOMI.map(r => {
      const min = parseFloat(r.compr_min);
      const max = parseFloat(r.compr_max);
      if (fascia === 'ALTA')  return max;
      if (fascia === 'MEDIA') return (min + max) / 2;
      return min; // BASSA
    });
    prezzo_base_mq = prezziBase.reduce((s, p) => s + p, 0) / righeOMI.length;
  } else {
    const err = new Error(`Nessun dato OMI per zona ${zona_codice}, tipologia "${tipologia}"`);
    err.code = 'DATI_OMI_ASSENTI';
    throw err;
  }

  // ── Step 4: Coefficiente piano ────────────────────────────────────────────
  const pianoClamped = Math.min(piano, 5);
  const tabellaP = ascensore ? COEFF_PIANO_CON_ASC : COEFF_PIANO_SENZA_ASC;
  const coeffPiano = tabellaP[pianoClamped] ?? 1.00;

  // ── Step 5: Coefficiente stato conservativo ───────────────────────────────
  const coeffStato = COEFF_STATO[stato_conservazione] ?? COEFF_STATO[stato] ?? 1.00;

  // ── Step 6: Dotazioni aggiuntive ─────────────────────────────────────────
  let totaleDotazioni = 0;
  const dotazioniApplicate = [];
  if (ascensore)        { totaleDotazioni += COEFF_DOTAZIONI.ascensore;       dotazioniApplicate.push('ascensore'); }
  if (box_auto)         { totaleDotazioni += COEFF_DOTAZIONI.box_auto;         dotazioniApplicate.push('box_auto'); }
  if (balcone_terrazza) { totaleDotazioni += COEFF_DOTAZIONI.balcone_terrazza; dotazioniApplicate.push('balcone'); }
  if (cantina)          { totaleDotazioni += COEFF_DOTAZIONI.cantina;          dotazioniApplicate.push('cantina'); }

  // ── Step 7: Prezzo corretto finale ───────────────────────────────────────
  const coefficienteFinale = coeffPiano * coeffStato * (1 + totaleDotazioni);
  const prezzo_corretto_mq = prezzo_base_mq * coefficienteFinale;

  // ── Step 8: Bonus superfici esterne e box ────────────────────────────────
  const bonusBalcone  = Math.round((parseFloat(balcone_mq)  || 0) * prezzo_corretto_mq * 0.30);
  const bonusTerrazza = Math.round((parseFloat(terrazza_mq) || 0) * prezzo_corretto_mq * 0.50);
  const bonusGiardino = Math.round((parseFloat(giardino_mq) || 0) * prezzo_corretto_mq * 0.20);
  const bonusBox      = BONUS_BOX[box_dimensione] ?? 0;
  const totalBonus    = bonusBalcone + bonusTerrazza + bonusGiardino + bonusBox;

  // ── Step 9: Valore medio OMI ──────────────────────────────────────────────
  const valore_medio_omi = prezzo_corretto_mq * superficie_mq;

  // ── Step 10: Integrazione comparabili manuali (peso 50%) ──────────────────
  const comparabiliValidi = comparabili_manuali.filter(c => c.superficie > 0 && c.prezzo > 0);
  let valore_medio;
  let prezzo_mq_comparabili = null;
  const usa_comparabili_manuali = comparabiliValidi.length > 0;

  if (usa_comparabili_manuali) {
    const sommaPrezziMq = comparabiliValidi.reduce((acc, c) => acc + (c.prezzo / c.superficie), 0);
    prezzo_mq_comparabili = Math.round(sommaPrezziMq / comparabiliValidi.length);
    const valore_medio_comp = prezzo_mq_comparabili * superficie_mq;
    valore_medio = Math.round((valore_medio_omi * 0.5 + valore_medio_comp * 0.5) + totalBonus);
  } else {
    valore_medio = Math.round(valore_medio_omi + totalBonus);
  }

  // ── Step 11: Range ±8% (UNI 11558) ───────────────────────────────────────
  const valore_min = Math.round(valore_medio * 0.92);
  const valore_max = Math.round(valore_medio * 1.08);


  return {
    zona_codice, tipologia, stato, superficie_mq, piano,
    fascia_omi: fascia,
    punti_alti: puntiAlti,
    prezzo_base_mq: Math.round(prezzo_base_mq),
    prezzo_corretto_mq: Math.round(prezzo_corretto_mq),
    coefficiente_piano: coeffPiano,
    coefficiente_stato: coeffStato,
    coefficiente_dotazioni: parseFloat(totaleDotazioni.toFixed(4)),
    coefficiente_finale: parseFloat(coefficienteFinale.toFixed(4)),
    dotazioni_applicate: dotazioniApplicate,
    classe_energetica, esposizione, vista, qualita_costruzione, luminosita, stato_conservazione,
    bonus_balcone: bonusBalcone,
    bonus_terrazza: bonusTerrazza,
    bonus_giardino: bonusGiardino,
    bonus_box: bonusBox,
    usa_comparabili_manuali,
    prezzo_mq_comparabili,
    valore_min,
    valore_medio,
    valore_max,
    numero_comparabili,
    anno_riferimento: righeOMI[0]?.anno ?? null,
    semestre_riferimento: righeOMI[0]?.semestre ?? null,
    omi_compr_min: avg_compr_min != null ? Math.round(avg_compr_min) : null,
    omi_compr_max: avg_compr_max != null ? Math.round(avg_compr_max) : null,
  };
}

module.exports = { calcolaVCM, calcolaFasciaOMI };
