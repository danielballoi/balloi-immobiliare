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

async function lista(req, res, next) {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const rows = await PortafoglioModel.getPortafoglio(req.user.id, parseInt(limit), parseInt(offset));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const result = await PortafoglioModel.getSummary(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function aggiungi(req, res, next) {
  try {
    const id = await PortafoglioModel.aggiungiImmobile(req.user.id, req.body);
    res.status(201).json({ success: true, id });
  } catch (err) {
    next(err);
  }
}

async function aggiorna(req, res, next) {
  try {
    const affected = await PortafoglioModel.aggiornaImmobile(req.user.id, req.params.id, req.body);
    if (!affected) return res.status(404).json({ error: 'Immobile non trovato' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function rimuovi(req, res, next) {
  try {
    const affected = await PortafoglioModel.rimuoviImmobile(req.user.id, req.params.id);
    if (!affected) return res.status(404).json({ error: 'Immobile non trovato' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { lista, summary, aggiungi, aggiorna, rimuovi };
