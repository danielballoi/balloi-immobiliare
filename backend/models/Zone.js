/**
 * @file Zone.js
 * @description Model per le zone OMI (tabella omi_zone).
 *   Contiene SOLO query SQL pure — nessuna logica HTTP.
 *   I controller chiamano queste funzioni e gestiscono req/res.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { pool } = require('../config/db');

/**
 * Recupera la lista delle zone con prezzi medi, deduplicata per nome quartiere.
 * Ogni quartiere appare una sola volta anche se ha più codici OMI interni.
 *
 * @param {string} comune  - Nome del comune (es. 'Cagliari')
 * @param {string} [area]  - Filtro area: 'CAGLIARI' | 'HINTERLAND' | null (tutti)
 * @returns {Promise<Array>} Array di zone con prezzo_medio e locazione_media
 */
async function getZoneConPrezzi(comune, area = null) {

  // Logica filtro:
  //   area specificata → filtra per area (CAGLIARI o HINTERLAND), ignora comune
  //   solo comune       → filtra per comune
  //   nessuno dei due   → nessun filtro (tutti)
  let whereClause = '';
  const params = [];
  if (area) {
    whereClause = 'WHERE z.area = $1';
    params.push(area);
  } else if (comune) {
    whereClause = 'WHERE z.comune = $1';
    params.push(comune);
  }

  const { rows } = await pool.query(`
    SELECT
      MIN(z.id)        AS id,
      MIN(z.link_zona) AS link_zona,
      z.descrizione_zona,
      z.comune,
      MAX(z.fascia)    AS fascia,
      z.area,
      AVG((v.compr_min + v.compr_max) / 2) AS prezzo_medio,
      AVG((v.loc_min   + v.loc_max)   / 2) AS locazione_media
    FROM omi_zone z
    LEFT JOIN omi_valori v
      ON TRIM(z.link_zona) = TRIM(v.zona_codice)
      AND v.anno = (SELECT MAX(anno) FROM omi_valori)
      AND v.stato = 'NORMALE'
    ${whereClause}
    GROUP BY z.descrizione_zona, z.comune, z.area
    ORDER BY z.descrizione_zona
  `, params);

  return rows;
}

/**
 * Recupera zone con prezzi per la heatmap, escludendo quelle senza prezzo.
 *
 * @param {string} comune  - Nome del comune
 * @param {string} stato   - Stato immobile (NORMALE, OTTIMO, SCADENTE)
 * @param {string} [area]  - Filtro area opzionale
 * @returns {Promise<Array>} Zone ordinate per prezzo decrescente
 */
async function getZoneHeatmap(comune, stato, area = null) {

  // Stessa logica di getZoneConPrezzi: area ha priorità su comune
  // Il primo parametro ($1) è sempre v.stato
  let whereClause = '';
  const paramsOrdinati = [stato];
  if (area) {
    whereClause = 'AND z.area = $2';
    paramsOrdinati.push(area);
  } else if (comune) {
    whereClause = 'AND z.comune = $2';
    paramsOrdinati.push(comune);
  }

  const { rows } = await pool.query(`
    SELECT
      MIN(z.id)        AS id,
      MIN(z.link_zona) AS link_zona,
      z.descrizione_zona,
      z.comune,
      MAX(z.fascia)    AS fascia,
      z.area,
      AVG((v.compr_min + v.compr_max) / 2) AS prezzo_medio,
      AVG((v.loc_min   + v.loc_max)   / 2) AS locazione_media
    FROM omi_zone z
    LEFT JOIN omi_valori v
      ON TRIM(z.link_zona) = TRIM(v.zona_codice)
      AND v.anno = (SELECT MAX(anno) FROM omi_valori)
      AND v.stato = $1
    WHERE 1=1 ${whereClause}
    GROUP BY z.descrizione_zona, z.comune, z.area
    HAVING AVG((v.compr_min + v.compr_max) / 2) IS NOT NULL
    ORDER BY AVG((v.compr_min + v.compr_max) / 2) DESC
  `, paramsOrdinati);

  return rows;
}

/**
 * Ricerca zone per testo (autocomplete).
 *
 * @param {string} q       - Testo di ricerca
 * @param {string} comune  - Comune da filtrare
 * @returns {Promise<Array>} Lista zone corrispondenti (max 20)
 */
async function searchZone(q, comune) {
  const { rows } = await pool.query(`
    SELECT id, link_zona, descrizione_zona, comune, fascia, area
    FROM omi_zone
    WHERE comune = $1
      AND (descrizione_zona LIKE $2 OR link_zona LIKE $3)
    ORDER BY descrizione_zona
    LIMIT 20
  `, [comune, `%${q}%`, `%${q}%`]);
  return rows;
}

/**
 * Recupera il dettaglio di una singola zona per codice link_zona.
 *
 * @param {string} codice - Codice link_zona (es. 'CA_D_12')
 * @returns {Promise<Object|null>} Zona con prezzi medi, null se non trovata
 */
async function getZonaByCode(codice) {
  const { rows } = await pool.query(`
    SELECT
      z.*,
      AVG((v.compr_min + v.compr_max) / 2) AS prezzo_medio_normale,
      AVG((v.loc_min   + v.loc_max)   / 2) AS locazione_media_normale
    FROM omi_zone z
    LEFT JOIN omi_valori v
      ON TRIM(z.link_zona) = TRIM(v.zona_codice)
      AND v.anno = (SELECT MAX(anno) FROM omi_valori)
      AND v.stato = 'NORMALE'
    WHERE z.link_zona = $1
    GROUP BY z.id
  `, [codice]);
  return rows.length ? rows[0] : null;
}

/**
 * Lista i comuni distinti presenti nella tabella omi_zone.
 * Utile per la feature Hinterland: mostra quali comuni sono disponibili.
 *
 * @returns {Promise<Array>} Array di { comune, area, totale_zone }
 */
async function getComuniDisponibili() {
  const { rows } = await pool.query(`
    SELECT
      comune,
      area,
      COUNT(*) AS totale_zone
    FROM omi_zone
    GROUP BY comune, area
    ORDER BY area ASC, comune ASC
  `);
  return rows;
}

/**
 * Inserisce o aggiorna una zona in omi_zone.
 * Usato dall'import CSV zone (feature Hinterland).
 *
 * @param {Object} zona - Dati della zona da inserire
 * @returns {Promise<Object>} Risultato (rowCount)
 */
async function upsertZona(zona) {
  const result = await pool.query(`
    INSERT INTO omi_zone (link_zona, descrizione_zona, comune, fascia, tipologia, area)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (link_zona) DO UPDATE SET
      descrizione_zona = EXCLUDED.descrizione_zona,
      comune           = EXCLUDED.comune,
      fascia           = EXCLUDED.fascia,
      tipologia        = EXCLUDED.tipologia,
      area             = EXCLUDED.area
  `, [
    zona.link_zona,
    zona.descrizione_zona,
    zona.comune,
    zona.fascia,
    zona.tipologia,
    zona.area,
  ]);
  return result;
}

module.exports = {
  getZoneConPrezzi,
  getZoneHeatmap,
  searchZone,
  getZonaByCode,
  getComuniDisponibili,
  upsertZona,
};
