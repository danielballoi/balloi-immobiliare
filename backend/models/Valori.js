/**
 * @file Valori.js
 * @description Model per i valori OMI (tabella omi_valori).
 *   Contiene query per statistiche, trend storici e dettaglio tipologie.
 *   Nessuna logica HTTP — solo funzioni async che ritornano dati.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { pool } = require('../config/db');

/**
 * Recupera valori OMI con filtri opzionali.
 *
 * @param {Object} filtri               - Filtri da applicare
 * @param {string} [filtri.zona_codice] - Codice zona OMI
 * @param {string} [filtri.tipologia]   - Tipologia immobile (ricerca parziale)
 * @param {string} [filtri.stato]       - Stato immobile (NORMALE/OTTIMO/SCADENTE)
 * @param {number} [filtri.anno]        - Anno di rilevazione
 * @param {string} [filtri.semestre]    - Semestre (1 o 2)
 * @returns {Promise<Array>} Lista valori (max 200)
 */
async function getValori({ zona_codice, tipologia, stato, anno, semestre } = {}) {
  console.log('[MODEL-VALORI] getValori con filtri:', { zona_codice, tipologia, stato, anno, semestre });

  // Costruiamo la query dinamicamente solo con i filtri forniti
  let sql = `
    SELECT v.*, z.descrizione_zona,
      (v.compr_min + v.compr_max) / 2 AS prezzo_medio_mq,
      (v.loc_min   + v.loc_max)   / 2 AS locazione_media_mq
    FROM omi_valori v
    LEFT JOIN omi_zone z ON TRIM(v.zona_codice) = TRIM(z.link_zona)
    WHERE 1=1
  `;
  const params = [];

  if (zona_codice) { sql += ' AND v.zona_codice = ?';               params.push(zona_codice); }
  if (tipologia)   { sql += ' AND v.descrizione_tipologia LIKE ?';  params.push(`%${tipologia}%`); }
  if (stato)       { sql += ' AND v.stato = ?';                     params.push(stato); }
  if (anno)        { sql += ' AND v.anno = ?';                      params.push(anno); }
  if (semestre)    { sql += ' AND v.semestre LIKE ?';               params.push(`%${semestre}%`); }

  sql += ' ORDER BY v.anno DESC, v.semestre DESC LIMIT 200';

  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Lista delle tipologie immobili distinte presenti nel DB.
 *
 * @returns {Promise<string[]>} Array di nomi tipologia
 */
async function getTipologie() {
  const [rows] = await pool.query(`
    SELECT DISTINCT descrizione_tipologia
    FROM omi_valori
    WHERE descrizione_tipologia IS NOT NULL
    ORDER BY descrizione_tipologia
  `);
  return rows.map(r => r.descrizione_tipologia);
}

/**
 * Lista anni e semestri disponibili nel database.
 *
 * @returns {Promise<Array>} Array di { anno, semestre }
 */
async function getAnniDisponibili() {
  const [rows] = await pool.query(`
    SELECT DISTINCT anno, semestre
    FROM omi_valori
    ORDER BY anno DESC, semestre DESC
  `);
  return rows;
}

/**
 * Statistiche prezzi per zona (anno più recente), ripartite per tipologia e stato.
 * Se viene passato `nome`, aggrega TUTTE le sottozone con lo stesso nome quartiere
 * (utile quando un quartiere ha più codici OMI interni).
 *
 * @param {string} zona  - Codice zona OMI (usato se nome non specificato)
 * @param {string} [nome] - Nome quartiere (aggrega per nome, ignorando zona)
 * @param {string} [comune] - Comune per filtrare per nome (default 'Cagliari')
 * @returns {Promise<Array>} Statistiche per tipologia/stato
 */
async function getStatistiche(zona, nome = null, comune = 'Cagliari') {
  let sql, params;

  if (nome) {
    // Aggrega per nome quartiere: include tutti i codici OMI con lo stesso nome
    console.log(`[MODEL-VALORI] getStatistiche per nome quartiere: ${nome}`);
    sql = `
      SELECT
        v.stato,
        v.descrizione_tipologia,
        AVG((v.compr_min + v.compr_max) / 2) AS prezzo_medio_mq,
        MIN(v.compr_min)                     AS prezzo_min,
        MAX(v.compr_max)                     AS prezzo_max,
        AVG((v.loc_min + v.loc_max) / 2)     AS locazione_media_mq,
        COUNT(*)                             AS num_records
      FROM omi_valori v
      WHERE v.zona_codice IN (
        SELECT link_zona FROM omi_zone
        WHERE descrizione_zona = ? AND comune = ?
      )
      AND v.anno = (SELECT MAX(anno) FROM omi_valori)
      GROUP BY v.stato, v.descrizione_tipologia
      ORDER BY v.stato, v.descrizione_tipologia
    `;
    params = [nome, comune];
  } else {
    // Query per codice zona esatto (compatibilità con link vecchi)
    console.log(`[MODEL-VALORI] getStatistiche per codice zona: ${zona}`);
    sql = `
      SELECT
        v.stato,
        v.descrizione_tipologia,
        AVG((v.compr_min + v.compr_max) / 2) AS prezzo_medio_mq,
        MIN(v.compr_min)                     AS prezzo_min,
        MAX(v.compr_max)                     AS prezzo_max,
        AVG((v.loc_min + v.loc_max) / 2)     AS locazione_media_mq,
        COUNT(*)                             AS num_records
      FROM omi_valori v
      WHERE v.zona_codice = ?
        AND v.anno = (SELECT MAX(anno) FROM omi_valori)
      GROUP BY v.stato, v.descrizione_tipologia
      ORDER BY v.stato, v.descrizione_tipologia
    `;
    params = [zona];
  }

  const [rows] = await pool.query(sql, params);
  console.log(`[MODEL-VALORI] Statistiche: ${rows.length} righe`);
  return rows;
}

/**
 * Trend storico dei prezzi per una zona (serie temporale).
 * Con `nome` aggrega per anno (1 punto/anno) tutti i codici della stessa zona.
 * Senza `nome` usa il codice zona esatto, raggruppando per semestre.
 *
 * @param {string} zona          - Codice zona OMI
 * @param {Object} opzioni       - Opzioni aggiuntive
 * @param {string} [opzioni.nome]      - Nome quartiere (aggrega per nome)
 * @param {string} [opzioni.stato]     - Stato immobile (default NORMALE)
 * @param {string} [opzioni.tipologia] - Filtra per tipologia specifica
 * @param {string} [opzioni.comune]    - Comune (default 'Cagliari')
 * @returns {Promise<Array>} Serie temporale prezzi
 */
async function getTrend(zona, { nome, stato = 'NORMALE', tipologia, comune = 'Cagliari' } = {}) {
  let sql, params;

  if (nome) {
    // Trend annuale aggregato per nome quartiere
    console.log(`[MODEL-VALORI] getTrend annuale per quartiere: ${nome}`);
    sql = `
      SELECT
        anno,
        AVG((compr_min + compr_max) / 2) AS prezzo_medio_mq,
        AVG((loc_min   + loc_max)   / 2) AS locazione_media_mq
      FROM omi_valori
      WHERE zona_codice IN (
        SELECT link_zona FROM omi_zone
        WHERE descrizione_zona = ? AND comune = ?
      )
      AND stato = ?
    `;
    params = [nome, comune, stato];
    if (tipologia) { sql += ' AND descrizione_tipologia LIKE ?'; params.push(`%${tipologia}%`); }
    sql += ' GROUP BY anno ORDER BY anno ASC';
  } else {
    // Trend per codice zona esatto, raggruppato per semestre
    console.log(`[MODEL-VALORI] getTrend per codice zona: ${zona}`);
    sql = `
      SELECT
        anno,
        semestre,
        AVG((compr_min + compr_max) / 2) AS prezzo_medio_mq,
        AVG((loc_min   + loc_max)   / 2) AS locazione_media_mq
      FROM omi_valori
      WHERE zona_codice = ? AND stato = ?
    `;
    params = [zona, stato];
    if (tipologia) { sql += ' AND descrizione_tipologia LIKE ?'; params.push(`%${tipologia}%`); }
    sql += ' GROUP BY anno, semestre ORDER BY anno ASC, semestre ASC';
  }

  const [rows] = await pool.query(sql, params);
  console.log(`[MODEL-VALORI] Trend: ${rows.length} periodi`);
  return rows;
}

/**
 * Dettaglio storico annuale per una specifica tipologia in un quartiere.
 * Aggrega tutti i codici OMI del quartiere filtrati per tipologia.
 *
 * @param {string} nome   - Nome quartiere
 * @param {string} tipo   - Descrizione tipologia (es. 'Abitazioni civili')
 * @param {string} stato  - Stato immobile (default 'NORMALE')
 * @param {string} [comune] - Comune (default 'Cagliari')
 * @returns {Promise<Array>} Un record per anno con statistiche prezzi
 */
async function getTipologiaAnnuale(nome, tipo, stato = 'NORMALE', comune = 'Cagliari') {
  console.log(`[MODEL-VALORI] getTipologiaAnnuale: ${tipo} in ${nome}`);

  const [rows] = await pool.query(`
    SELECT
      anno,
      COUNT(*)                             AS num_records,
      AVG((compr_min + compr_max) / 2)     AS prezzo_medio_mq,
      MIN(compr_min)                       AS prezzo_min,
      MAX(compr_max)                       AS prezzo_max,
      AVG((loc_min + loc_max) / 2)         AS locazione_media_mq
    FROM omi_valori
    WHERE zona_codice IN (
      SELECT link_zona FROM omi_zone
      WHERE descrizione_zona = ? AND comune = ?
    )
    AND descrizione_tipologia = ?
    AND stato = ?
    GROUP BY anno
    ORDER BY anno ASC
  `, [nome, comune, tipo, stato]);

  console.log(`[MODEL-VALORI] Tipologia-annuale: ${rows.length} anni`);
  return rows;
}

module.exports = {
  getValori,
  getTipologie,
  getAnniDisponibili,
  getStatistiche,
  getTrend,
  getTipologiaAnnuale,
};
