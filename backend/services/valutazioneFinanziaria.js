/**
 * SERVICE: Valutazione Finanziaria (DCF - Discounted Cash Flow)
 *
 * Il metodo DCF stima il valore di un investimento immobiliare
 * attualizzando tutti i flussi di cassa futuri previsti sull'orizzonte
 * temporale scelto (tipicamente 5-10 anni).
 *
 * Metriche prodotte:
 *   - VAN  (Valore Attuale Netto / NPV): Se positivo, l'investimento
 *           crea valore rispetto al tasso di attualizzazione richiesto.
 *   - TIR  (Tasso Interno di Rendimento / IRR): Tasso a cui VAN = 0.
 *   - ROI  (Return on Investment): Guadagno totale / capitale investito.
 *   - Cash-on-Cash: Flusso di cassa annuo / equity investita (rileva la leva).
 *   - Rata mutuo: Calcolata con formula ammortamento alla francese.
 */

/**
 * calcolaRataMutuo - Ammortamento alla francese (rata costante)
 *
 * Formula: R = P × [i(1+i)^n] / [(1+i)^n - 1]
 * dove P=capitale, i=tasso mensile, n=mesi totali
 *
 * @param {number} capitale       - Importo finanziato
 * @param {number} tasso_annuo_pct - Tasso interesse annuo %
 * @param {number} durata_anni    - Durata finanziamento in anni
 * @returns {number} Rata mensile
 */
function calcolaRataMutuo(capitale, tasso_annuo_pct, durata_anni) {
  if (tasso_annuo_pct === 0 || durata_anni === 0) return 0;
  const i = tasso_annuo_pct / 100 / 12;     // tasso mensile
  const n = durata_anni * 12;               // numero rate
  const rata = capitale * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  return Math.round(rata * 100) / 100;
}

/**
 * calcolaTIR - Calcola il TIR (IRR) con metodo Newton-Raphson
 *
 * Il TIR è il tasso r tale che: Σ(CF_t / (1+r)^t) = 0
 * Essendo un'equazione trascendente, usiamo iterazione numerica.
 *
 * @param {number[]} flussi - Array di flussi di cassa [CF0, CF1, ..., CFn]
 * @returns {number|null} TIR in percentuale, o null se non converge
 */
function calcolaTIR(flussi) {
  let tasso = 0.10;  // guess iniziale al 10%
  const MAX_ITER = 1000;
  const PRECISION = 1e-7;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Calcola VAN e sua derivata prima rispetto al tasso
    let van = 0;
    let dVan = 0;
    flussi.forEach((cf, t) => {
      const fattore = Math.pow(1 + tasso, t);
      van  += cf / fattore;
      dVan -= t * cf / (fattore * (1 + tasso));
    });

    if (Math.abs(dVan) < PRECISION) break;  // derivata nulla, ferma

    const nuovoTasso = tasso - van / dVan;

    if (Math.abs(nuovoTasso - tasso) < PRECISION) {
      return parseFloat((nuovoTasso * 100).toFixed(2));  // converso
    }
    tasso = nuovoTasso;
  }

  console.warn('[DCF] TIR non convergente con Newton-Raphson, uso bisezione');

  // Fallback: metodo della bisezione (più lento ma robusto)
  let low = -0.99, high = 10.0;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const mid = (low + high) / 2;
    const van = flussi.reduce((acc, cf, t) => acc + cf / Math.pow(1 + mid, t), 0);
    if (Math.abs(van) < 1) return parseFloat((mid * 100).toFixed(2));
    if (van > 0) low = mid; else high = mid;
  }

  return null;  // non trovato
}

/**
 * calcolaDCF - Analisi DCF completa
 *
 * @param {object} params
 * @param {number}   params.prezzo_acquisto          - Prezzo di acquisto immobile (€)
 * @param {number}   params.costi_acquisto_pct       - Costi acquisto % (notaio, tasse, agenzia) default 10%
 * @param {number}   params.costi_ristrutturazione   - Costi ristrutturazione iniziali (€)
 * @param {number}   params.ltv_pct                  - Loan-To-Value % (quota finanziata con mutuo)
 * @param {number}   params.tasso_mutuo_pct          - Tasso interesse mutuo annuo %
 * @param {number}   params.durata_mutuo_anni        - Durata mutuo in anni
 * @param {number}   params.canone_mensile           - Canone mensile lordo (€)
 * @param {number}   params.vacancy_pct             - Tasso di sfitto % (default 5%)
 * @param {number}   params.spese_operative_annue   - Spese operative annue (€)
 * @param {number}   params.tasso_crescita_noi_pct  - Crescita annua del NOI % (inflazione affitti)
 * @param {number}   params.orizzonte_anni          - Anni di proiezione (default 5)
 * @param {number}   params.tasso_attualizzazione_pct - WACC / tasso sconto %
 * @param {string}   params.metodo_exit             - "reddituale" o "apprezzamento"
 * @param {number}   params.cap_rate_exit_pct       - Cap rate per valorizzazione finale
 * @param {number}   params.tasso_crescita_valore_pct - Crescita annua del valore immobile %
 * @param {Array}    params.capex_straordinari       - [{anno: 2, importo: 5000}, ...] lavori extra
 * @returns {object} Analisi DCF completa con cash flows annuali
 */
function calcolaDCF({
  prezzo_acquisto,
  costi_acquisto_pct = 10,
  costi_ristrutturazione = 0,
  ltv_pct = 0,
  tasso_mutuo_pct = 0,
  durata_mutuo_anni = 20,
  canone_mensile,
  vacancy_pct = 5,
  spese_operative_annue = 0,
  tasso_crescita_noi_pct = 2,
  orizzonte_anni = 5,
  tasso_attualizzazione_pct = 6,
  metodo_exit = 'reddituale',
  cap_rate_exit_pct = 5,
  tasso_crescita_valore_pct = 2,
  capex_straordinari = [],
}) {
  console.log(`[DCF] Inizio calcolo - prezzo: €${prezzo_acquisto}, canone: €${canone_mensile}/mese, orizzonte: ${orizzonte_anni} anni`);

  // ── Step 1: Struttura del capitale ───────────────────────────────────────
  const costi_acquisto  = prezzo_acquisto * (costi_acquisto_pct / 100);
  const investimento_totale = prezzo_acquisto + costi_acquisto + costi_ristrutturazione;

  // Quota finanziata con mutuo e quota equity (propria)
  const debito = prezzo_acquisto * (ltv_pct / 100);
  const equity = investimento_totale - debito;

  // Rata mensile mutuo (ammortamento francese)
  const rata_mensile = debito > 0 && tasso_mutuo_pct > 0
    ? calcolaRataMutuo(debito, tasso_mutuo_pct, durata_mutuo_anni)
    : 0;
  const debito_annuo = rata_mensile * 12;

  console.log(`[DCF] Struttura capitale - equity: €${equity.toFixed(0)}, debito: €${debito.toFixed(0)}, rata: €${rata_mensile.toFixed(2)}/mese`);

  // ── Step 2: NOI anno 0 (base) ─────────────────────────────────────────────
  const reddito_lordo_base = canone_mensile * 12;
  const noi_base = reddito_lordo_base * (1 - vacancy_pct / 100) - spese_operative_annue;

  // ── Step 3: Proiezione cash flows annuali ────────────────────────────────
  const flussi_cassa_annui = [];   // flussi di cassa operativi (per VAN/TIR)
  const cashflows_dettaglio = [];  // dettaglio anno per anno (per visualizzazione)

  // Il flusso anno 0 è negativo: esborso iniziale (solo equity, il mutuo lo gestisce la banca)
  const cf_anno_0 = -equity;
  flussi_cassa_annui.push(cf_anno_0);

  for (let anno = 1; anno <= orizzonte_anni; anno++) {
    // NOI cresce ogni anno del tasso di crescita
    const crescita = Math.pow(1 + tasso_crescita_noi_pct / 100, anno - 1);
    const noi_anno = noi_base * crescita;

    // Capex straordinari programmati (es. rifacimento tetto al 3° anno)
    const capex = capex_straordinari
      .filter(c => c.anno === anno)
      .reduce((sum, c) => sum + c.importo, 0);

    // Cash flow levered (dopo il servizio del debito)
    const cf_operativo = noi_anno - debito_annuo - capex;

    // Valore attuale del flusso (attualizzazione)
    const fattore_att = Math.pow(1 + tasso_attualizzazione_pct / 100, anno);
    const cf_attualizzato = cf_operativo / fattore_att;

    flussi_cassa_annui.push(cf_operativo);

    cashflows_dettaglio.push({
      anno,
      noi: Math.round(noi_anno),
      debito_annuo: Math.round(debito_annuo),
      capex: Math.round(capex),
      cash_flow_netto: Math.round(cf_operativo),
      cash_flow_attualizzato: Math.round(cf_attualizzato),
    });
  }

  // ── Step 4: Valore di rivendita finale (Exit Value) ───────────────────────
  let valore_rivendita;
  if (metodo_exit === 'reddituale') {
    // Capitalizza il NOI dell'anno finale con il cap rate di uscita
    const noi_finale = noi_base * Math.pow(1 + tasso_crescita_noi_pct / 100, orizzonte_anni);
    valore_rivendita = noi_finale / (cap_rate_exit_pct / 100);
    console.log(`[DCF] Exit reddituale: NOI finale €${noi_finale.toFixed(0)}, valore rivendita €${valore_rivendita.toFixed(0)}`);
  } else {
    // Apprezzamento del valore immobile nel tempo
    valore_rivendita = prezzo_acquisto * Math.pow(1 + tasso_crescita_valore_pct / 100, orizzonte_anni);
    console.log(`[DCF] Exit apprezzamento: valore rivendita €${valore_rivendita.toFixed(0)}`);
  }

  // Saldo mutuo residuo all'anno di exit (approssimazione lineare)
  const quota_rimborsata = debito > 0
    ? debito * Math.min(orizzonte_anni / durata_mutuo_anni, 1)
    : 0;
  const debito_residuo = debito - quota_rimborsata;

  // Provento netto dalla rivendita (al netto del debito residuo)
  const provento_netto_exit = valore_rivendita - debito_residuo;

  // Aggiungi l'exit al flusso dell'ultimo anno
  const ultimo_cf = flussi_cassa_annui[orizzonte_anni];
  flussi_cassa_annui[orizzonte_anni] = ultimo_cf + provento_netto_exit;

  if (cashflows_dettaglio.length > 0) {
    cashflows_dettaglio[cashflows_dettaglio.length - 1].exit_value = Math.round(provento_netto_exit);
    cashflows_dettaglio[cashflows_dettaglio.length - 1].cash_flow_netto += Math.round(provento_netto_exit);
  }

  // ── Step 5: VAN (NPV) ─────────────────────────────────────────────────────
  // VAN = Σ(CF_t / (1+r)^t) per t da 0 a n
  const van = flussi_cassa_annui.reduce((acc, cf, t) => {
    return acc + cf / Math.pow(1 + tasso_attualizzazione_pct / 100, t);
  }, 0);

  // ── Step 6: TIR (IRR) ────────────────────────────────────────────────────
  const tir_pct = calcolaTIR(flussi_cassa_annui);

  // ── Step 7: ROI totale ────────────────────────────────────────────────────
  // ROI = (Guadagno totale - Investimento iniziale) / Investimento iniziale
  const guadagno_totale = flussi_cassa_annui.slice(1).reduce((a, b) => a + b, 0);
  const roi_totale_pct = ((guadagno_totale - equity) / equity) * 100;

  // ── Step 8: Cash-on-Cash (primo anno) ────────────────────────────────────
  // Misura il rendimento sul capitale proprio nel primo anno operativo
  const cf_primo_anno = cashflows_dettaglio[0]?.cash_flow_netto ?? 0;
  const cash_on_cash_pct = equity > 0 ? (cf_primo_anno / equity) * 100 : 0;

  console.log(`[DCF] VAN: €${van.toFixed(0)}, TIR: ${tir_pct}%, ROI: ${roi_totale_pct.toFixed(2)}%`);

  return {
    // Struttura capitale
    investimento_totale: Math.round(investimento_totale),
    costi_acquisto: Math.round(costi_acquisto),
    equity: Math.round(equity),
    debito: Math.round(debito),
    rata_mensile,
    debito_residuo: Math.round(debito_residuo),
    // NOI
    noi_base_annuo: Math.round(noi_base),
    // Cash flows
    cashflows_dettaglio,
    // Exit
    valore_rivendita_finale: Math.round(valore_rivendita),
    provento_netto_exit: Math.round(provento_netto_exit),
    // Metriche finanziarie
    van: Math.round(van),
    tir_pct,
    roi_totale_pct: parseFloat(roi_totale_pct.toFixed(2)),
    cash_on_cash_pct: parseFloat(cash_on_cash_pct.toFixed(2)),
    // Flag interpretativo
    investimento_conveniente: van > 0,
  };
}

module.exports = { calcolaDCF, calcolaRataMutuo };
