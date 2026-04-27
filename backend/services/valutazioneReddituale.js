/**
 * SERVICE: Valutazione Reddituale
 *
 * Il metodo reddituale stima il valore di un immobile in base alla
 * sua capacità di generare reddito (affitto), capitalizzando il
 * reddito netto con un tasso di capitalizzazione (Cap Rate).
 *
 * Formula base:
 *   Valore = NOI / Cap Rate
 *
 * Dove NOI (Net Operating Income) =
 *   Canone Lordo Annuo × (1 - Vacancy%) - Spese Operative Annue
 */

/**
 * calcolaReddituale - Calcola la valutazione con metodo reddituale
 *
 * @param {object} params
 * @param {number} params.canone_mensile   - Canone di locazione mensile lordo (€)
 * @param {number} params.vacancy_pct      - Tasso di sfitto percentuale (default 5%)
 * @param {number} params.spese_annue      - Spese operative annue (IMU, assicurazione, ecc.) (€)
 * @param {number} params.cap_rate_pct     - Tasso di capitalizzazione % (es. 5 = 5%)
 * @param {number} params.superficie_mq    - Superficie in mq (opzionale, per calcolo rendimento/mq)
 * @param {number|null} params.prezzo_acquisto - Se fornito, calcola rendimenti su prezzo reale
 * @returns {object} Risultato valutazione reddituale
 */
function calcolaReddituale({
  canone_mensile,
  vacancy_pct = 5,
  spese_annue = 0,
  cap_rate_pct,
  superficie_mq = 0,
  prezzo_acquisto = null,
}) {
  console.log(`[REDDITUALE] Inizio calcolo - canone: €${canone_mensile}/mese, cap_rate: ${cap_rate_pct}%, vacancy: ${vacancy_pct}%`);

  // ── Step 1: Reddito lordo annuo (Gross Operating Income) ─────────────────
  // Canone mensile × 12 mesi
  const reddito_lordo_annuo = canone_mensile * 12;

  // ── Step 2: Perdita per sfitto (vacancy) ──────────────────────────────────
  // Es: 5% di vacancy = l'immobile rimane vuoto in media 18 giorni/anno
  const perdita_sfitto = reddito_lordo_annuo * (vacancy_pct / 100);
  const reddito_effettivo = reddito_lordo_annuo - perdita_sfitto;

  // ── Step 3: NOI (Net Operating Income) ───────────────────────────────────
  // Reddito effettivo meno le spese operative (IMU, manutenzione, gestione)
  const noi_annuo = reddito_effettivo - spese_annue;

  // ── Step 4: Valore di mercato per capitalizzazione ────────────────────────
  const cap_rate_decimale = cap_rate_pct / 100;
  const valore_mercato = noi_annuo / cap_rate_decimale;

  // ── Step 5: Rendimenti ────────────────────────────────────────────────────
  // Se prezzo_acquisto fornito → rendimenti sul prezzo reale pagato
  // Altrimenti → null (non calcolabili senza riferimento reale)
  let rendimento_lordo_pct = null;
  let rendimento_netto_pct = null;
  if (prezzo_acquisto && prezzo_acquisto > 0) {
    rendimento_lordo_pct = parseFloat(((reddito_lordo_annuo / prezzo_acquisto) * 100).toFixed(2));
    rendimento_netto_pct = parseFloat(((noi_annuo / prezzo_acquisto) * 100).toFixed(2));
  }

  // ── Step 6: Rendimento per mq (opzionale) ────────────────────────────────
  const canone_annuo_mq = superficie_mq > 0 ? (reddito_lordo_annuo / superficie_mq) : null;

  console.log(`[REDDITUALE] NOI annuo: €${noi_annuo.toFixed(2)}, Valore mercato: €${valore_mercato.toFixed(0)}`);
  if (rendimento_lordo_pct !== null)
    console.log(`[REDDITUALE] Rendimento lordo: ${rendimento_lordo_pct}%, netto: ${rendimento_netto_pct}% (su prezzo acquisto)`);

  return {
    // Input
    canone_mensile,
    vacancy_pct,
    spese_annue,
    cap_rate_pct,
    prezzo_acquisto: prezzo_acquisto ?? null,
    // Calcoli intermedi
    reddito_lordo_annuo: Math.round(reddito_lordo_annuo),
    perdita_sfitto: Math.round(perdita_sfitto),
    reddito_effettivo: Math.round(reddito_effettivo),
    noi_annuo: Math.round(noi_annuo),
    // Output principale
    valore_mercato: Math.round(valore_mercato),
    rendimento_lordo_pct,
    rendimento_netto_pct,
    // Extra
    canone_annuo_mq: canone_annuo_mq ? parseFloat(canone_annuo_mq.toFixed(2)) : null,
  };
}

module.exports = { calcolaReddituale };
