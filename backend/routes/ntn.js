/**
 * Route /api/ntn — Mappa URL → controller (zero business logic)
 *   GET /zona   Volumi NTN per quartiere+tipologia (?nome=&tipo=&comune=)
 *   GET /stats  Totale record NTN e anni disponibili
 */

const router = require('express').Router();
const ctrl   = require('../controllers/ntnController');

router.get('/zona',  ctrl.ntnZona);
router.get('/stats', ctrl.stats);

module.exports = router;
