/**
 * @file portafoglioController.js
 * @description Controller per il portafoglio immobiliare.
 *   Ruolo: gestisce le operazioni CRUD sul portafoglio,
 *   delegando tutta la logica SQL al model Portafoglio.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const PortafoglioModel = require('../models/Portafoglio');

/**
 * GET /api/portafoglio
 * Lista tutti gli immobili in portafoglio.
 */
async function lista(req, res, next) {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const rows = await PortafoglioModel.getPortafoglio(parseInt(limit), parseInt(offset));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/portafoglio/summary
 * KPI aggregati del portafoglio (valore totale, canone, TIR medio, ecc.).
 */
async function summary(req, res, next) {
  try {
    const result = await PortafoglioModel.getSummary();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/portafoglio
 * Aggiunge un immobile al portafoglio.
 */
async function aggiungi(req, res, next) {
  try {
    const id = await PortafoglioModel.aggiungiImmobile(req.body);
    res.status(201).json({ success: true, id });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/portafoglio/:id
 * Aggiorna i dati di un immobile in portafoglio.
 */
async function aggiorna(req, res, next) {
  try {
    await PortafoglioModel.aggiornaImmobile(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/portafoglio/:id
 * Rimuove un immobile dal portafoglio.
 */
async function rimuovi(req, res, next) {
  try {
    await PortafoglioModel.rimuoviImmobile(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { lista, summary, aggiungi, aggiorna, rimuovi };
