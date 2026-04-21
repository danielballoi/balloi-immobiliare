/**
 * @file Valutazioni.js
 * @description Model per le valutazioni immobiliari (tabella valutazioni).
 *   Gestisce il salvataggio e recupero delle stime di valore calcolate
 *   tramite i metodi VCM, Reddituale e DCF.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { pool } = require('../config/db');

/**
 * Salva una valutazione completa nel database.
 * Riceve tutti i dati calcolati dai tre metodi di valutazione.
 *
 * @param {Object} data - Dati della valutazione (tutte le colonne della tabella)
 * @returns {Promise<number>} ID della valutazione inserita
 */
async function salvaValutazione(data) {
  console.log(`[MODEL-VALUTAZIONI] salvaValutazione: ${data.indirizzo} in ${data.zona_codice}`);

  const [result] = await pool.query(`
    INSERT INTO valutazioni (
      indirizzo, zona_codice, tipologia, stato_immobile, superficie_mq,
      piano, anno_costruzione, ascensore, box_auto, balcone_terrazza, cantina,
      vcm_prezzo_base_mq, vcm_valore_min, vcm_valore_medio, vcm_valore_max, vcm_numero_comparabili,
      red_canone_mensile_lordo, red_noi_annuo, red_spese_annue, red_vacancy_pct,
      red_cap_rate_pct, red_valore_mercato, red_rendimento_lordo_pct, red_rendimento_netto_pct,
      dcf_prezzo_acquisto, dcf_costi_acquisto_pct, dcf_costi_ristrutturazione, dcf_capitale_investito,
      dcf_ltv_pct, dcf_tasso_mutuo_pct, dcf_durata_mutuo_anni, dcf_rata_mensile,
      dcf_orizzonte_anni, dcf_tasso_crescita_noi_pct, dcf_tasso_attualizzazione_pct,
      dcf_valore_rivendita_finale, dcf_van, dcf_tir_pct, dcf_roi_totale_pct, dcf_cash_on_cash_pct,
      metodologia_principale, note, salvato_portafoglio
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `, [
    data.indirizzo, data.zona_codice, data.tipologia, data.stato_immobile, data.superficie_mq,
    data.piano, data.anno_costruzione, data.ascensore ? 1 : 0, data.box_auto ? 1 : 0,
    data.balcone_terrazza ? 1 : 0, data.cantina ? 1 : 0,
    data.vcm_prezzo_base_mq, data.vcm_valore_min, data.vcm_valore_medio, data.vcm_valore_max, data.vcm_numero_comparabili,
    data.red_canone_mensile_lordo, data.red_noi_annuo, data.red_spese_annue, data.red_vacancy_pct,
    data.red_cap_rate_pct, data.red_valore_mercato, data.red_rendimento_lordo_pct, data.red_rendimento_netto_pct,
    data.dcf_prezzo_acquisto, data.dcf_costi_acquisto_pct, data.dcf_costi_ristrutturazione, data.dcf_capitale_investito,
    data.dcf_ltv_pct, data.dcf_tasso_mutuo_pct, data.dcf_durata_mutuo_anni, data.dcf_rata_mensile,
    data.dcf_orizzonte_anni, data.dcf_tasso_crescita_noi_pct, data.dcf_tasso_attualizzazione_pct,
    data.dcf_valore_rivendita_finale, data.dcf_van, data.dcf_tir_pct, data.dcf_roi_totale_pct, data.dcf_cash_on_cash_pct,
    data.metodologia_principale, data.note, data.salvato_portafoglio ? 1 : 0,
  ]);

  return result.insertId;
}

/**
 * Lista delle valutazioni salvate, ordinata per data (più recenti prima).
 *
 * @param {number} limit  - Numero massimo di record (default 50)
 * @param {number} offset - Offset per paginazione (default 0)
 * @returns {Promise<Array>} Lista valutazioni (colonne riassuntive)
 */
async function getValutazioni(limit = 50, offset = 0) {
  const [rows] = await pool.query(`
    SELECT id, indirizzo, zona_codice, tipologia, stato_immobile, superficie_mq,
      vcm_valore_medio, dcf_van, dcf_tir_pct, dcf_roi_totale_pct,
      metodologia_principale, data_valutazione, salvato_portafoglio
    FROM valutazioni
    ORDER BY data_valutazione DESC
    LIMIT ? OFFSET ?
  `, [parseInt(limit), parseInt(offset)]);
  return rows;
}

/**
 * Dettaglio completo di una valutazione per ID.
 *
 * @param {number} id - ID della valutazione
 * @returns {Promise<Object|null>} Valutazione completa, null se non trovata
 */
async function getValutazioneById(id) {
  const [rows] = await pool.query('SELECT * FROM valutazioni WHERE id = ?', [id]);
  return rows.length ? rows[0] : null;
}

/**
 * Elimina una valutazione dal database.
 *
 * @param {number} id - ID della valutazione da eliminare
 * @returns {Promise<void>}
 */
async function deleteValutazione(id) {
  await pool.query('DELETE FROM valutazioni WHERE id = ?', [id]);
}

module.exports = {
  salvaValutazione,
  getValutazioni,
  getValutazioneById,
  deleteValutazione,
};
