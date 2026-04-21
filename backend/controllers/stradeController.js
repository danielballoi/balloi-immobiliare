/**
 * @file stradeController.js
 * @description Controller per le strade di Cagliari.
 *   Ruolo: legge i parametri da req.query, chiama il model Strade,
 *   e invia la risposta JSON al client.
 *
 * @author Balloi Immobiliare Dev
 */

const StradeModel = require('../models/Strade');

/**
 * GET /api/strade/search?q=via+roma
 * Autocomplete: restituisce max 15 vie che contengono il testo cercato.
 * Ogni risultato include anche il quartiere e il link_zona OMI.
 */
async function search(req, res, next) {
  try {
    const { q = '' } = req.query;
    console.log(`[CTRL-STRADE] search: q="${q}"`);

    // Evita ricerche troppo corte che restituirebbero tutto il DB
    if (q.trim().length < 2) {
      return res.json([]);
    }

    const strade = await StradeModel.searchStrade(q.trim(), 15);
    res.json(strade);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/strade/quartiere/:nome
 * Lista di tutte le vie di un quartiere specifico.
 */
async function vieByQuartiere(req, res, next) {
  try {
    const { nome } = req.params;
    console.log(`[CTRL-STRADE] vieByQuartiere: nome="${nome}"`);

    const vie = await StradeModel.getVieByQuartiere(nome);
    res.json(vie);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/strade/quartieri
 * Lista di tutti i quartieri con conteggio vie.
 * Usato per debug e stats.
 */
async function quartieri(req, res, next) {
  try {
    console.log('[CTRL-STRADE] quartieri');
    const lista = await StradeModel.getQuartieriConVie();
    res.json(lista);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/strade/stats
 * Conta quante vie sono nel DB — utile per il frontend per sapere
 * se lo scraping è stato eseguito oppure no.
 */
async function stats(req, res, next) {
  try {
    const count = await StradeModel.countStrade();
    res.json({
      vie_totali: count,
      // Se non ci sono vie, lo scraping non è stato eseguito
      scraping_eseguito: count > 0,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, vieByQuartiere, quartieri, stats };
