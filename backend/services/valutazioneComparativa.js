/**
 * SERVICE: Valutazione Comparativa di Mercato (VCM)
 *
 * Questo metodo stima il valore di un immobile confrontandolo
 * con i prezzi di mercato OMI (Osservatorio del Mercato Immobiliare)
 * della stessa zona e tipologia.
 *
 * Logica:
 *   1. Recupera i valori OMI aggiornati per zona/tipologia/stato
 *   2. Calcola il prezzo base al mq (media tra min e max OMI)
 *   3. Applica coefficienti correttivi (piano, dotazioni)
 *   4. Moltiplica per la superficie → Range min/medio/max
 */

const { pool } = require('../config/db');

// ─── Tabella coefficienti per piano ───────────────────────────────────────────
const COEFF_PIANO = {
  0:  0.90,
  1:  0.95,
  2:  1.00,  // piano di riferimento neutro
  3:  1.02,
  4:  1.03,
  5:  1.00,  // oltre 5°: nessuna rivalutazione aggiuntiva
};

// ─── Coefficienti per stato conservativo ─────────────────────────────────────
// Il prezzo OMI viene sempre interrogato su stato NORMALE; questo coeff
// aggiusta il valore per lo stato reale dell'immobile.
const COEFF_STATO = {
  NORMALE:   1.00,
  OTTIMO:    1.10,
  SCADENTE:  0.85,
};

// ─── Coefficienti per dotazioni aggiuntive ────────────────────────────────────
const COEFF_DOTAZIONI = {
  ascensore:         0.03,
  box_auto:          0.05,
  balcone_terrazza:  0.02,
  cantina:           0.01,
};

/**
 * calcolaVCM - Funzione principale del service
 *
 * @param {object} params
 * @param {string} params.zona_codice     - Codice zona OMI (es. "D12")
 * @param {string} params.tipologia       - Tipologia immobile (es. "Abitazioni civili")
 * @param {string} params.stato           - Stato conservativo ("NORMALE", "OTTIMO", "SCADENTE")
 * @param {number} params.superficie_mq   - Superficie in mq
 * @param {number} params.piano           - Piano dell'immobile
 * @param {boolean} params.ascensore
 * @param {boolean} params.box_auto
 * @param {boolean} params.balcone_terrazza
 * @param {boolean} params.cantina
 * @param {boolean} params.giardino
 * @param {number|null} params.prezzo_base_override - Se fornito, sovrascrive il prezzo OMI
 * @returns {object} Risultato VCM completo
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
  giardino = false,
  prezzo_base_override = null,
}) {
  console.log(`[VCM] Inizio calcolo - zona: ${zona_codice}, tipo: ${tipologia}, stato: ${stato}, mq: ${superficie_mq}`);

  // ── Step 1: Recupera i valori OMI dal database ─────────────────────────────
  // NB: colonne reali nel DB sono compr_min/max e loc_min/max
  const [righeOMI] = await pool.query(`
    SELECT
      compr_min,
      compr_max,
      loc_min,
      loc_max,
      descrizione_tipologia,
      stato,
      anno,
      semestre
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

  console.log(`[VCM] Trovati ${righeOMI.length} record OMI comparabili`);

  // ── Step 2: Determina il prezzo base al mq ────────────────────────────────
  let prezzo_base_mq;
  let numero_comparabili = righeOMI.length;

  if (prezzo_base_override) {
    // L'utente ha inserito manualmente un prezzo di riferimento
    prezzo_base_mq = prezzo_base_override;
    console.log(`[VCM] Uso prezzo override: €${prezzo_base_mq}/mq`);
  } else if (righeOMI.length > 0) {
    // Calcola la media pesata tra tutti i record OMI trovati
    const somma = righeOMI.reduce((acc, r) => {
      return acc + (parseFloat(r.compr_min) + parseFloat(r.compr_max)) / 2;
    }, 0);
    prezzo_base_mq = somma / righeOMI.length;
    console.log(`[VCM] Prezzo base calcolato da OMI: €${prezzo_base_mq.toFixed(2)}/mq`);
  } else {
    // Nessun dato OMI disponibile: errore gestito
    console.warn(`[VCM] ATTENZIONE: nessun dato OMI per zona ${zona_codice}, tipo ${tipologia}, stato ${stato}`);
    throw new Error(`Nessun dato OMI disponibile per zona ${zona_codice}, tipologia "${tipologia}", stato "${stato}"`);
  }

  // ── Step 3: Coefficiente piano ────────────────────────────────────────────
  const pianoClamped = Math.min(piano, 5);
  const coeffPiano = COEFF_PIANO[pianoClamped] ?? 1.00;
  console.log(`[VCM] Coefficiente piano ${piano}: ${coeffPiano}`);

  // ── Step 4: Coefficiente stato conservativo ───────────────────────────────
  // Il prezzo OMI è interrogato sempre su NORMALE; coeff_stato aggiusta per lo stato reale
  const coeffStato = COEFF_STATO[stato] ?? 1.00;
  console.log(`[VCM] Coefficiente stato "${stato}": ${coeffStato}`);

  // ── Step 5: Coefficienti dotazioni ───────────────────────────────────────
  let totaleDotazioni = 0;
  const dotazioniApplicate = [];

  if (ascensore)        { totaleDotazioni += COEFF_DOTAZIONI.ascensore;       dotazioniApplicate.push('ascensore'); }
  if (box_auto)         { totaleDotazioni += COEFF_DOTAZIONI.box_auto;         dotazioniApplicate.push('box_auto'); }
  if (balcone_terrazza) { totaleDotazioni += COEFF_DOTAZIONI.balcone_terrazza; dotazioniApplicate.push('balcone_terrazza'); }
  if (cantina)          { totaleDotazioni += COEFF_DOTAZIONI.cantina;          dotazioniApplicate.push('cantina'); }

  console.log(`[VCM] Dotazioni applicate: [${dotazioniApplicate.join(', ')}] → +${(totaleDotazioni * 100).toFixed(1)}%`);

  // ── Step 6: Prezzo corretto finale al mq ─────────────────────────────────
  // Formula: prezzo_base × coeff_piano × coeff_stato × (1 + totale_dotazioni)
  const coefficienteFinale = coeffPiano * coeffStato * (1 + totaleDotazioni);
  const prezzo_corretto_mq = prezzo_base_mq * coefficienteFinale;

  // ── Step 7: Range di valori (min/medio/max) ───────────────────────────────
  // Spread fisso ±8% (non variabile dai dati OMI)
  const spread_pct = 0.08;

  const valore_min    = prezzo_corretto_mq * (1 - spread_pct) * superficie_mq;
  const valore_medio  = prezzo_corretto_mq * superficie_mq;
  const valore_max    = prezzo_corretto_mq * (1 + spread_pct) * superficie_mq;

  console.log(`[VCM] Risultato: min €${valore_min.toFixed(0)}, medio €${valore_medio.toFixed(0)}, max €${valore_max.toFixed(0)}`);

  return {
    // Dati di input usati
    zona_codice,
    tipologia,
    stato,
    superficie_mq,
    piano,
    // Prezzi base
    prezzo_base_mq: Math.round(prezzo_base_mq),
    prezzo_corretto_mq: Math.round(prezzo_corretto_mq),
    // Coefficienti applicati
    coefficiente_piano: coeffPiano,
    coefficiente_stato: coeffStato,
    coefficiente_dotazioni: parseFloat(totaleDotazioni.toFixed(4)),
    coefficiente_finale: parseFloat(coefficienteFinale.toFixed(4)),
    dotazioni_applicate: dotazioniApplicate,
    // Valori immobile
    valore_min: Math.round(valore_min),
    valore_medio: Math.round(valore_medio),
    valore_max: Math.round(valore_max),
    // Metadati
    numero_comparabili,
    anno_riferimento: righeOMI[0]?.anno ?? null,
    semestre_riferimento: righeOMI[0]?.semestre ?? null,
  };
}

module.exports = { calcolaVCM };
