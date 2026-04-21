/**
 * @file Portafoglio.js
 * @description Model per il portafoglio immobiliare (tabella portafoglio).
 *   Il portafoglio raccoglie gli immobili che l'utente ha "salvato" dopo
 *   la valutazione, con dati sintetici su rendimento e valore.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { pool } = require('../config/db');

/**
 * Recupera tutti gli immobili in portafoglio con dati della valutazione collegata.
 *
 * @param {number} limit  - Numero massimo di record (default 100)
 * @param {number} offset - Offset per paginazione (default 0)
 * @returns {Promise<Array>} Lista immobili in portafoglio
 */
async function getPortafoglio(limit = 100, offset = 0) {
  console.log('[MODEL-PORTAFOGLIO] getPortafoglio');

  const [rows] = await pool.query(`
    SELECT
      p.*,
      v.vcm_valore_min,
      v.vcm_valore_max,
      v.dcf_orizzonte_anni,
      v.dcf_tasso_attualizzazione_pct,
      v.metodologia_principale,
      v.data_valutazione
    FROM portafoglio p
    LEFT JOIN valutazioni v ON p.valutazione_id = v.id
    ORDER BY p.data_inserimento DESC
    LIMIT ? OFFSET ?
  `, [parseInt(limit), parseInt(offset)]);

  console.log(`[MODEL-PORTAFOGLIO] Trovati ${rows.length} immobili`);
  return rows;
}

/**
 * Calcola i KPI aggregati dell'intero portafoglio.
 * Include valore totale, canone mensile, TIR medio, VAN totale e plusvalenza potenziale.
 *
 * @returns {Promise<Object>} Summary con tutte le metriche aggregate
 */
async function getSummary() {
  console.log('[MODEL-PORTAFOGLIO] getSummary');

  const [rows] = await pool.query(`
    SELECT
      COUNT(*)                        AS num_immobili,
      SUM(prezzo_acquisto)            AS investimento_totale,
      SUM(vcm_valore_medio)           AS valore_stimato_totale,
      SUM(canone_mensile)             AS canone_mensile_totale,
      SUM(canone_mensile * 12)        AS canone_annuo_totale,
      AVG(tir_pct)                    AS tir_medio,
      SUM(van)                        AS van_totale,
      AVG(roi_totale_pct)             AS roi_medio
    FROM portafoglio
  `);

  const summary = rows[0];

  // Calcolo plusvalenza: differenza tra valore stimato e prezzo pagato
  summary.plusvalenza_potenziale = summary.valore_stimato_totale - summary.investimento_totale;
  summary.plusvalenza_pct = summary.investimento_totale > 0
    ? ((summary.plusvalenza_potenziale / summary.investimento_totale) * 100).toFixed(2)
    : 0;

  console.log(`[MODEL-PORTAFOGLIO] Summary: ${summary.num_immobili} immobili`);
  return summary;
}

/**
 * Aggiunge un immobile al portafoglio.
 * Se viene fornito un valutazione_id, segna quella valutazione come "salvata in portafoglio".
 *
 * @param {Object} dati - Dati dell'immobile da aggiungere
 * @returns {Promise<number>} ID del record inserito
 */
async function aggiungiImmobile(dati) {
  console.log(`[MODEL-PORTAFOGLIO] aggiungiImmobile: ${dati.indirizzo || 'N/A'}`);

  // Se c'è un collegamento a una valutazione, aggiorna il flag
  if (dati.valutazione_id) {
    await pool.query(
      'UPDATE valutazioni SET salvato_portafoglio = 1 WHERE id = ?',
      [dati.valutazione_id]
    );
  }

  const [result] = await pool.query(`
    INSERT INTO portafoglio (
      valutazione_id, indirizzo, zona_codice, tipologia, stato_immobile,
      superficie_mq, prezzo_acquisto, canone_mensile, vcm_valore_medio,
      tir_pct, roi_totale_pct, van, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    dati.valutazione_id || null,
    dati.indirizzo, dati.zona_codice, dati.tipologia, dati.stato_immobile,
    dati.superficie_mq, dati.prezzo_acquisto, dati.canone_mensile, dati.vcm_valore_medio,
    dati.tir_pct, dati.roi_totale_pct, dati.van, dati.note,
  ]);

  console.log(`[MODEL-PORTAFOGLIO] Immobile inserito con ID: ${result.insertId}`);
  return result.insertId;
}

/**
 * Aggiorna i dati di un immobile in portafoglio.
 * Usa COALESCE: aggiorna solo i campi forniti, mantiene i vecchi per i null.
 *
 * @param {number} id   - ID dell'immobile in portafoglio
 * @param {Object} dati - Campi da aggiornare
 * @returns {Promise<void>}
 */
async function aggiornaImmobile(id, dati) {
  console.log(`[MODEL-PORTAFOGLIO] aggiornaImmobile ID: ${id}`);

  await pool.query(`
    UPDATE portafoglio SET
      canone_mensile   = COALESCE(?, canone_mensile),
      vcm_valore_medio = COALESCE(?, vcm_valore_medio),
      tir_pct          = COALESCE(?, tir_pct),
      roi_totale_pct   = COALESCE(?, roi_totale_pct),
      van              = COALESCE(?, van),
      note             = COALESCE(?, note)
    WHERE id = ?
  `, [dati.canone_mensile, dati.vcm_valore_medio, dati.tir_pct, dati.roi_totale_pct, dati.van, dati.note, id]);
}

/**
 * Rimuove un immobile dal portafoglio.
 * Aggiorna anche il flag salvato_portafoglio nella tabella valutazioni.
 *
 * @param {number} id - ID dell'immobile da rimuovere
 * @returns {Promise<void>}
 */
async function rimuoviImmobile(id) {
  console.log(`[MODEL-PORTAFOGLIO] rimuoviImmobile ID: ${id}`);

  // Prima recupera il valutazione_id per aggiornare il flag
  const [rows] = await pool.query('SELECT valutazione_id FROM portafoglio WHERE id = ?', [id]);

  if (rows.length && rows[0].valutazione_id) {
    await pool.query(
      'UPDATE valutazioni SET salvato_portafoglio = 0 WHERE id = ?',
      [rows[0].valutazione_id]
    );
  }

  await pool.query('DELETE FROM portafoglio WHERE id = ?', [id]);
  console.log(`[MODEL-PORTAFOGLIO] Immobile ${id} rimosso`);
}

module.exports = {
  getPortafoglio,
  getSummary,
  aggiungiImmobile,
  aggiornaImmobile,
  rimuoviImmobile,
};
