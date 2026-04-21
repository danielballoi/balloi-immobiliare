/**
 * Route /api/import — Mappa URL → controller (zero business logic)
 *   GET  /template              Colonne CSV attese
 *   GET  /log                   Storico importazioni
 *   GET  /stats                 Statistiche DB (totale record, anni)
 *   POST /csv                   Import prezzi OMI da CSV (multipart/form-data)
 *   POST /ntn                   Import NTN da CSV (multipart/form-data)
 *   POST /zone                  Import definizioni zone da CSV — feature Hinterland
 *   POST /manuale               Inserimento manuale singolo record
 *   POST /cartella              Import bulk da cartella DATI_HINTERLAND sul server
 *   POST /omi-semestrale-zone   Import ZONE.csv formato ufficiale OMI (Agenzia Entrate)
 *   POST /omi-semestrale-valori Import VALORI.csv formato ufficiale OMI (Agenzia Entrate)
 */

const router = require('express').Router();
const ctrl   = require('../controllers/importController');

// Middleware upload: usato per le route POST con file CSV
const upload = ctrl.uploadMiddleware;

router.get('/template',                        ctrl.template);
router.get('/log',                             ctrl.getLog);
router.get('/stats',                           ctrl.getStats);
router.post('/csv',                  upload,   ctrl.importCSV);
router.post('/ntn',                  upload,   ctrl.importNTN);
router.post('/zone',                 upload,   ctrl.importZone);
router.post('/manuale',                        ctrl.insertManuale);
router.post('/cartella',                       ctrl.importCartella);
router.post('/omi-semestrale-zone',  upload,   ctrl.importOMIZone);
router.post('/omi-semestrale-valori', upload,  ctrl.importOMIValori);

module.exports = router;
