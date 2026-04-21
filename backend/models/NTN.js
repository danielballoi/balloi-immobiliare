/**
 * @file NTN.js
 * @description Model per il Numero di Transazioni Normalizzate (tabella omi_ntn).
 *   L'NTN misura i volumi di mercato: quante compravendite e locazioni avvengono
 *   per zona e tipologia. Dati provenienti dall'Agenzia delle Entrate.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { pool } = require('../config/db');

/**
 * Recupera i volumi NTN annuali per un quartiere e una tipologia.
 * Aggrega tutte le sottozone con lo stesso nome quartiere.
 *
 * @param {string} nome  - Nome quartiere (es. 'MARINA - STAMPACE')
 * @param {string} tipo  - Tipologia immobile (es. 'Abitazioni civili')
 * @param {string} [comune] - Comune di riferimento (default 'Cagliari')
 * @returns {Promise<Array>} Un record per anno: { anno, ntn_compravendita, ntn_locazione }
 */
async function getNTNZona(nome, tipo, comune = 'Cagliari') {
  console.log(`[MODEL-NTN] getNTNZona: ${tipo} in ${nome}`);

  const [rows] = await pool.query(`
    SELECT
      anno,
      SUM(ntn_compravendita) AS ntn_compravendita,
      SUM(ntn_locazione)     AS ntn_locazione
    FROM omi_ntn
    WHERE zona_codice IN (
      SELECT link_zona FROM omi_zone
      WHERE descrizione_zona = ? AND comune = ?
    )
    AND descrizione_tipologia = ?
    GROUP BY anno
    ORDER BY anno ASC
  `, [nome, comune, tipo]);

  console.log(`[MODEL-NTN] ${rows.length} anni trovati`);
  return rows;
}

/**
 * Statistiche generali dei dati NTN nel database.
 * Mostra quanti record ci sono e quali anni sono disponibili.
 *
 * @returns {Promise<Object>} { totale_ntn, anni_disponibili[] }
 */
async function getStatsNTN() {
  const [[{ totale }]] = await pool.query('SELECT COUNT(*) AS totale FROM omi_ntn');
  const [anni]         = await pool.query('SELECT DISTINCT anno FROM omi_ntn ORDER BY anno DESC');
  return {
    totale_ntn: totale,
    anni_disponibili: anni.map(r => r.anno),
  };
}

module.exports = {
  getNTNZona,
  getStatsNTN,
};
