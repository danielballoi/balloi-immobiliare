/**
 * Route /api/portafoglio — Mappa URL → controller (zero business logic)
 *   GET    /         Lista immobili in portafoglio
 *   GET    /summary  KPI aggregati del portafoglio
 *   POST   /         Aggiunge immobile al portafoglio
 *   PUT    /:id      Aggiorna dati immobile
 *   DELETE /:id      Rimuove immobile dal portafoglio
 */

const router = require('express').Router();
const ctrl   = require('../controllers/portafoglioController');

router.get('/summary', ctrl.summary);
router.get('/',        ctrl.lista);
router.post('/',       ctrl.aggiungi);
router.put('/:id',     ctrl.aggiorna);
router.delete('/:id',  ctrl.rimuovi);

module.exports = router;
