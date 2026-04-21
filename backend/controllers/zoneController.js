/**
 * @file zoneController.js
 * @description Controller per le zone OMI.
 *   Ruolo: legge i parametri da req.query/req.params, chiama il model Zone,
 *   e invia la risposta JSON al client.
 *   Non contiene query SQL — tutta la logica dati è nel model.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const ZoneModel = require('../models/Zone');

/**
 * GET /api/zone
 * Restituisce la lista delle zone con prezzi medi, deduplicate per quartiere.
 * Supporta filtro per comune e area (CAGLIARI / HINTERLAND).
 */
async function listaZone(req, res, next) {
  try {
    // comune senza default: se non passato + area assente → mostra tutto
    const { comune, area } = req.query;
    console.log(`[CTRL-ZONE] listaZone: comune=${comune}, area=${area}`);

    const zone = await ZoneModel.getZoneConPrezzi(comune || null, area || null);
    res.json(zone);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/zone/heatmap
 * Restituisce zone con prezzi per la heatmap (esclude zone senza prezzo).
 */
async function heatmap(req, res, next) {
  try {
    // comune senza default: se non passato + area assente → mostra tutte le zone
    const { comune, stato = 'NORMALE', area } = req.query;
    console.log(`[CTRL-ZONE] heatmap: comune=${comune}, stato=${stato}, area=${area}`);

    const zone = await ZoneModel.getZoneHeatmap(comune || null, stato, area || null);
    res.json(zone);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/zone/search?q=marina
 * Autocomplete ricerca zone per nome o codice.
 */
async function search(req, res, next) {
  try {
    const { q = '', comune = 'Cagliari' } = req.query;
    const zone = await ZoneModel.searchZone(q, comune);
    res.json(zone);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/zone/comuni
 * Lista i comuni disponibili nel database con il loro numero di zone.
 * Utile per la feature Hinterland.
 */
async function comuni(req, res, next) {
  try {
    console.log('[CTRL-ZONE] comuni disponibili');
    const lista = await ZoneModel.getComuniDisponibili();
    res.json(lista);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/zone/:codice
 * Dettaglio di una singola zona per codice link_zona.
 */
async function dettaglio(req, res, next) {
  try {
    const zona = await ZoneModel.getZonaByCode(req.params.codice);
    if (!zona) return res.status(404).json({ error: 'Zona non trovata' });
    res.json(zona);
  } catch (err) {
    next(err);
  }
}

module.exports = { listaZone, heatmap, search, comuni, dettaglio };
