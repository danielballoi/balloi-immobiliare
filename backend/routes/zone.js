/**
 * Route /api/zone — Mappa URL → controller (zero business logic)
 *   GET /          Lista zone con prezzi medi (?comune=&area=)
 *   GET /comuni    Lista comuni disponibili nel DB (hinterland)
 *   GET /heatmap   Zone con prezzi per la dashboard (?comune=&stato=&area=)
 *   GET /search    Autocomplete (?q=&comune=)
 *   GET /:codice   Dettaglio singola zona
 */

const router = require('express').Router();
const ctrl   = require('../controllers/zoneController');

router.get('/comuni',  ctrl.comuni);
router.get('/heatmap', ctrl.heatmap);
router.get('/search',  ctrl.search);
router.get('/',        ctrl.listaZone);
router.get('/:codice', ctrl.dettaglio);

module.exports = router;
