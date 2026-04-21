/**
 * @file valoriController.js
 * @description Controller per i valori OMI (prezzi compravendita e locazione).
 *   Ruolo: valida i parametri HTTP, chiama il model Valori, risponde in JSON.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const ValoriModel = require('../models/Valori');

/**
 * GET /api/valori
 * Lista valori con filtri opzionali.
 */
async function listaValori(req, res, next) {
  try {
    const { zona_codice, tipologia, stato, anno, semestre } = req.query;
    const rows = await ValoriModel.getValori({ zona_codice, tipologia, stato, anno, semestre });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valori/tipologie
 * Lista tipologie immobili distinte.
 */
async function listaTipologie(req, res, next) {
  try {
    const tipologie = await ValoriModel.getTipologie();
    res.json(tipologie);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valori/anni
 * Anni e semestri disponibili nel database.
 */
async function listaAnni(req, res, next) {
  try {
    const anni = await ValoriModel.getAnniDisponibili();
    res.json(anni);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valori/statistiche/:zona
 * Statistiche prezzi per zona (anno più recente).
 * Con ?nome=NOME_QUARTIERE aggrega tutte le sottozone omonime.
 */
async function statistiche(req, res, next) {
  try {
    // Il nome quartiere può arrivare come query param o come parametro URL
    const { nome, comune = 'Cagliari' } = req.query;
    const zona = req.params.zona;

    console.log(`[CTRL-VALORI] statistiche: zona=${zona}, nome=${nome}`);
    const rows = await ValoriModel.getStatistiche(zona, nome || null, comune);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valori/trend/:zona
 * Trend storico prezzi per zona.
 * Con ?nome= aggrega per anno tutti i codici dello stesso quartiere.
 */
async function trend(req, res, next) {
  try {
    const { nome, stato = 'NORMALE', tipologia, comune = 'Cagliari' } = req.query;
    const zona = req.params.zona;

    console.log(`[CTRL-VALORI] trend: zona=${zona}, nome=${nome}`);
    const rows = await ValoriModel.getTrend(zona, { nome, stato, tipologia, comune });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valori/tipologia-annuale
 * Dettaglio storico annuale per una tipologia specifica in un quartiere.
 * Richiede ?nome= e ?tipo= obbligatoriamente.
 */
async function tipologiaAnnuale(req, res, next) {
  try {
    const { nome, tipo, stato = 'NORMALE', comune = 'Cagliari' } = req.query;
    if (!nome || !tipo) {
      return res.status(400).json({ error: 'Parametri nome e tipo richiesti' });
    }

    console.log(`[CTRL-VALORI] tipologiaAnnuale: ${tipo} in ${nome}`);
    const rows = await ValoriModel.getTipologiaAnnuale(nome, tipo, stato, comune);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listaValori, listaTipologie, listaAnni, statistiche, trend, tipologiaAnnuale };
