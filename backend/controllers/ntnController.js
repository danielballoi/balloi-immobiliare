/**
 * @file ntnController.js
 * @description Controller per il Numero di Transazioni Normalizzate (NTN).
 *   Ruolo: legge i query params, chiama il model NTN, risponde in JSON.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const NTNModel = require('../models/NTN');

/**
 * GET /api/ntn/zona?nome=MARINA - STAMPACE&tipo=Abitazioni civili
 * Volumi annuali per quartiere + tipologia.
 */
async function ntnZona(req, res, next) {
  try {
    const { nome, tipo, comune = 'Cagliari' } = req.query;
    if (!nome || !tipo) {
      return res.status(400).json({ error: 'Parametri obbligatori: nome, tipo' });
    }

    console.log(`[CTRL-NTN] ntnZona: ${tipo} in ${nome}`);
    const rows = await NTNModel.getNTNZona(nome, tipo, comune);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/ntn/stats
 * Statistiche generali dei dati NTN (totale record, anni disponibili).
 */
async function stats(req, res, next) {
  try {
    const result = await NTNModel.getStatsNTN();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { ntnZona, stats };
