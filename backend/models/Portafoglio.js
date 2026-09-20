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

async function getPortafoglio(userId, limit = 100, offset = 0) {
  const [rows] = await pool.query(`
    SELECT
      p.*,
      COALESCE(p.vcm_valore_min, v.vcm_valore_min)       AS vcm_valore_min,
      COALESCE(p.vcm_valore_max, v.vcm_valore_max)       AS vcm_valore_max,
      COALESCE(p.dcf_van, v.dcf_van)                     AS dcf_van,
      COALESCE(p.dcf_tir_pct, v.dcf_tir_pct)             AS dcf_tir_pct,
      COALESCE(p.dcf_roi_totale_pct, v.dcf_roi_totale_pct) AS dcf_roi_totale_pct,
      COALESCE(p.dcf_cash_on_cash_pct, v.dcf_cash_on_cash_pct) AS dcf_cash_on_cash_pct,
      COALESCE(p.red_valore_mercato, v.red_valore_mercato) AS red_valore_mercato,
      COALESCE(p.red_noi_annuo, v.red_noi_annuo)          AS red_noi_annuo,
      COALESCE(p.red_rendimento_lordo_pct, v.red_rendimento_lordo_pct) AS red_rendimento_lordo_pct,
      COALESCE(p.red_rendimento_netto_pct, v.red_rendimento_netto_pct) AS red_rendimento_netto_pct,
      v.dcf_orizzonte_anni,
      v.dcf_tasso_attualizzazione_pct,
      v.metodologia_principale,
      v.data_valutazione
    FROM portafoglio p
    LEFT JOIN valutazioni v ON p.valutazione_id = v.id
    WHERE p.user_id = ?
    ORDER BY p.data_inserimento DESC
    LIMIT ? OFFSET ?
  `, [userId, parseInt(limit), parseInt(offset)]);

  return rows;
}

async function getSummary(userId) {
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
    WHERE user_id = ?
  `, [userId]);

  const summary = rows[0];
  summary.plusvalenza_potenziale = summary.valore_stimato_totale - summary.investimento_totale;
  summary.plusvalenza_pct = summary.investimento_totale > 0
    ? ((summary.plusvalenza_potenziale / summary.investimento_totale) * 100).toFixed(2)
    : 0;

  return summary;
}

async function aggiungiImmobile(userId, dati) {
  // Verifica che la valutazione appartenga all'utente
  if (dati.valutazione_id) {
    const [v] = await pool.query(
      'SELECT id FROM valutazioni WHERE id = ? AND user_id = ?',
      [dati.valutazione_id, userId]
    );
    if (!v.length) throw Object.assign(new Error('Valutazione non trovata'), { status: 404 });

    await pool.query(
      'UPDATE valutazioni SET salvato_portafoglio = 1 WHERE id = ? AND user_id = ?',
      [dati.valutazione_id, userId]
    );
  }

  const [result] = await pool.query(`
    INSERT INTO portafoglio (
      user_id,
      valutazione_id, indirizzo, zona_codice, tipologia, stato_immobile,
      superficie_mq, prezzo_acquisto, fonte_prezzo, canone_mensile, vcm_valore_medio,
      tir_pct, roi_totale_pct, van, note,
      classe_energetica, esposizione, vista, qualita_costruzione, luminosita, stato_conservazione,
      fascia_omi, tipo_valutazione,
      vcm_valore_min, vcm_valore_max, vcm_prezzo_base_mq, vcm_punti_alti,
      red_valore_mercato, red_noi_annuo, red_rendimento_lordo_pct, red_rendimento_netto_pct,
      dcf_van, dcf_tir_pct, dcf_roi_totale_pct, dcf_cash_on_cash_pct
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?)
  `, [
    userId,
    dati.valutazione_id || null,
    dati.indirizzo, dati.zona_codice, dati.tipologia, dati.stato_immobile,
    dati.superficie_mq, dati.prezzo_acquisto, dati.fonte_prezzo ?? null, dati.canone_mensile, dati.vcm_valore_medio,
    dati.tir_pct, dati.roi_totale_pct, dati.van, dati.note,
    dati.classe_energetica ?? null, dati.esposizione ?? null, dati.vista ?? null,
    dati.qualita_costruzione ?? null, dati.luminosita ?? null, dati.stato_conservazione ?? null,
    dati.fascia_omi ?? null, dati.tipo_valutazione ?? null,
    dati.vcm_valore_min ?? null, dati.vcm_valore_max ?? null, dati.vcm_prezzo_base_mq ?? null, dati.vcm_punti_alti ?? null,
    dati.red_valore_mercato ?? null, dati.red_noi_annuo ?? null, dati.red_rendimento_lordo_pct ?? null, dati.red_rendimento_netto_pct ?? null,
    dati.dcf_van ?? null, dati.dcf_tir_pct ?? null, dati.dcf_roi_totale_pct ?? null, dati.dcf_cash_on_cash_pct ?? null,
  ]);

  return result.insertId;
}

async function aggiornaImmobile(userId, id, dati) {
  const [result] = await pool.query(`
    UPDATE portafoglio SET
      canone_mensile   = COALESCE(?, canone_mensile),
      vcm_valore_medio = COALESCE(?, vcm_valore_medio),
      tir_pct          = COALESCE(?, tir_pct),
      roi_totale_pct   = COALESCE(?, roi_totale_pct),
      van              = COALESCE(?, van),
      note             = COALESCE(?, note)
    WHERE id = ? AND user_id = ?
  `, [dati.canone_mensile, dati.vcm_valore_medio, dati.tir_pct, dati.roi_totale_pct, dati.van, dati.note, id, userId]);

  return result.affectedRows;
}

async function rimuoviImmobile(userId, id) {
  const [rows] = await pool.query(
    'SELECT valutazione_id FROM portafoglio WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!rows.length) return 0;

  if (rows[0].valutazione_id) {
    await pool.query(
      'UPDATE valutazioni SET salvato_portafoglio = 0 WHERE id = ? AND user_id = ?',
      [rows[0].valutazione_id, userId]
    );
  }

  const [result] = await pool.query('DELETE FROM portafoglio WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows;
}

module.exports = {
  getPortafoglio,
  getSummary,
  aggiungiImmobile,
  aggiornaImmobile,
  rimuoviImmobile,
};
