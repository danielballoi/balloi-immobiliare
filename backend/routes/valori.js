/**
 * Route /api/valori — Mappa URL → controller (zero business logic)
 *   GET /tipologie              Lista tipologie distinte
 *   GET /anni                   Anni e semestri disponibili
 *   GET /tipologia-annuale      Dettaglio annuale per tipologia (?nome=&tipo=&stato=)
 *   GET /statistiche/:zona      Statistiche per zona (?nome=&comune=)
 *   GET /trend/:zona            Trend storico (?nome=&stato=&tipologia=)
 *   GET /                       Lista valori con filtri opzionali
 */

const router = require('express').Router();
const ctrl   = require('../controllers/valoriController');

router.get('/tipologie',          ctrl.listaTipologie);
router.get('/anni',               ctrl.listaAnni);
router.get('/tipologia-annuale',  ctrl.tipologiaAnnuale);
router.get('/statistiche/:zona',  ctrl.statistiche);
router.get('/trend/:zona',        ctrl.trend);
router.get('/',                   ctrl.listaValori);

module.exports = router;
