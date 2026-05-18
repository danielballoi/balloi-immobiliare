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
  const { rows } = await pool.query(`
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
    WHERE p.user_id = $1
    ORDER BY p.data_inserimento DESC
    LIMIT $2 OFFSET $3
  `, [userId, parseInt(limit), parseInt(offset)]);

  return rows;
}

async function getSummary(userId) {
  const { rows } = await pool.query(`
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
    WHERE user_id = $1
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
    const { rows: v } = await pool.query(
      'SELECT id FROM valutazioni WHERE id = $1 AND user_id = $2',
      [dati.valutazione_id, userId]
    );
    if (!v.length) throw Object.assign(new Error('Valutazione non trovata'), { status: 404 });

    await pool.query(
      'UPDATE valutazioni SET salvato_portafoglio = TRUE WHERE id = $1 AND user_id = $2',
      [dati.valutazione_id, userId]
    );
  }

  const { rows } = await pool.query(`
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
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20, $21,
              $22, $23,
              $24, $25, $26, $27,
              $28, $29, $30, $31,
              $32, $33, $34, $35)
    RETURNING id
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

  return rows[0].id;
}

async function aggiornaImmobile(userId, id, dati) {
  const result = await pool.query(`
    UPDATE portafoglio SET
      canone_mensile   = COALESCE($1, canone_mensile),
      vcm_valore_medio = COALESCE($2, vcm_valore_medio),
      tir_pct          = COALESCE($3, tir_pct),
      roi_totale_pct   = COALESCE($4, roi_totale_pct),
      van              = COALESCE($5, van),
      note             = COALESCE($6, note)
    WHERE id = $7 AND user_id = $8
  `, [dati.canone_mensile, dati.vcm_valore_medio, dati.tir_pct, dati.roi_totale_pct, dati.van, dati.note, id, userId]);

  return result.rowCount;
}

async function rimuoviImmobile(userId, id) {
  const { rows } = await pool.query(
    'SELECT valutazione_id FROM portafoglio WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (!rows.length) return 0;

  if (rows[0].valutazione_id) {
    await pool.query(
      'UPDATE valutazioni SET salvato_portafoglio = FALSE WHERE id = $1 AND user_id = $2',
      [rows[0].valutazione_id, userId]
    );
  }

  const result = await pool.query('DELETE FROM portafoglio WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rowCount;
}

module.exports = {
  getPortafoglio,
  getSummary,
  aggiungiImmobile,
  aggiornaImmobile,
  rimuoviImmobile,
};
