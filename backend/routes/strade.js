/**
 * Route /api/strade — Mappa URL → controller
 *   GET /search?q=     Autocomplete vie per nome (min 2 caratteri)
 *   GET /stats         Conta le vie nel DB (per sapere se scraping eseguito)
 *   GET /quartieri     Lista quartieri con conteggio vie
 *   GET /quartiere/:nome  Tutte le vie di un quartiere
 */

const router = require('express').Router();
const ctrl   = require('../controllers/stradeController');

// IMPORTANTE: le route specifiche vanno PRIMA di quelle con parametri dinamici
router.get('/search',           ctrl.search);
router.get('/stats',            ctrl.stats);
router.get('/quartieri',        ctrl.quartieri);
router.get('/quartiere/:nome',  ctrl.vieByQuartiere);

module.exports = router;
