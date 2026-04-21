/**
 * Route /api/valutazioni — Mappa URL → controller (zero business logic)
 *   POST /calcola-vcm          Calcola valutazione comparativa (VCM)
 *   POST /calcola-reddituale   Calcola valutazione reddituale
 *   POST /calcola-dcf          Calcola analisi DCF
 *   POST /salva                Salva valutazione nel DB
 *   GET  /                     Lista valutazioni salvate
 *   GET  /:id                  Dettaglio valutazione
 *   DELETE /:id                Elimina valutazione
 */

const router = require('express').Router();
const ctrl   = require('../controllers/valutazioniController');

router.post('/calcola-vcm',        ctrl.calcolaVCMHandler);
router.post('/calcola-reddituale', ctrl.calcolaRedditualeHandler);
router.post('/calcola-dcf',        ctrl.calcolaDCFHandler);
router.post('/salva',              ctrl.salva);
router.get('/',                    ctrl.lista);
router.get('/:id',                 ctrl.dettaglio);
router.delete('/:id',              ctrl.elimina);

module.exports = router;
