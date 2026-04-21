/**
 * @file importController.js
 * @description Controller per l'importazione dati OMI da CSV.
 *   Ruolo: gestisce l'upload del file, fa il parsing CSV, e delega al model Import.
 *   Nota: multer e papaparse stanno qui (gestione I/O HTTP),
 *   mentre la logica di inserimento nel DB è nel model.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const multer = require('multer');
const Papa   = require('papaparse');
const ImportModel = require('../models/Import');

// ── Configurazione multer: file in memoria, max 50MB, solo CSV ─────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file CSV sono accettati'));
    }
  },
});

// Esportiamo il middleware upload per usarlo nelle route
const uploadMiddleware = upload.single('file');

// ── Helper: parse CSV e normalizza le intestazioni ────────────────────────
function parseCSV(buffer, separatore = ';') {
  const contenuto = buffer.toString('utf-8');
  const parsed = Papa.parse(contenuto, {
    header: true,
    delimiter: separatore,
    skipEmptyLines: true,
    // Normalizza le intestazioni: lowercase, spazi → underscore
    transformHeader: h => h.trim().toLowerCase().replace(/[\s\-\/]+/g, '_'),
  });
  return parsed;
}

/**
 * GET /api/import/template
 * Restituisce le colonne attese nel CSV OMI (aiuto all'utente).
 */
function template(req, res) {
  const colonne = [
    { campo: 'zona_codice',           obbligatorio: true,  esempio: 'D12',              descrizione: 'Codice zona OMI' },
    { campo: 'descrizione_tipologia', obbligatorio: true,  esempio: 'Abitazioni civili', descrizione: 'Tipo immobile' },
    { campo: 'stato',                 obbligatorio: true,  esempio: 'NORMALE',           descrizione: 'NORMALE / OTTIMO / SCADENTE' },
    { campo: 'anno',                  obbligatorio: true,  esempio: '2023',              descrizione: 'Anno rilevazione' },
    { campo: 'semestre',              obbligatorio: true,  esempio: '2',                 descrizione: '1 o 2' },
    { campo: 'compravendita_min',     obbligatorio: true,  esempio: '1500',              descrizione: '€/mq minimo compravendita' },
    { campo: 'compravendita_max',     obbligatorio: true,  esempio: '2000',              descrizione: '€/mq massimo compravendita' },
    { campo: 'locazione_min',         obbligatorio: false, esempio: '6',                 descrizione: '€/mq/mese minimo locazione' },
    { campo: 'locazione_max',         obbligatorio: false, esempio: '9',                 descrizione: '€/mq/mese massimo locazione' },
  ];
  res.json({ colonne, separatore_atteso: ';', esempio_riga: 'D12;Abitazioni civili;NORMALE;2023;2;1500;2000;6;9' });
}

/**
 * POST /api/import/csv
 * Upload e importazione CSV con dati prezzi OMI nella tabella omi_valori.
 */
async function importCSV(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

  console.log(`[CTRL-IMPORT] importCSV: ${req.file.originalname}, ${req.file.size} bytes`);
  const { separatore = ';' } = req.body;

  const parsed = parseCSV(req.file.buffer, separatore);
  if (parsed.errors.length > 0) {
    console.warn(`[CTRL-IMPORT] Errori parsing CSV: ${parsed.errors.length}`);
  }

  try {
    const result = await ImportModel.importaCSVValori(req.file.originalname, parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/manuale
 * Inserimento manuale di un singolo record in omi_valori.
 */
async function insertManuale(req, res, next) {
  try {
    const { zona_codice, descrizione_tipologia, anno, semestre, compravendita_min, compravendita_max } = req.body;

    // Validazione campi obbligatori
    if (!zona_codice || !descrizione_tipologia || !anno || !semestre ||
        !compravendita_min || !compravendita_max) {
      return res.status(400).json({
        error: 'Campi obbligatori: zona_codice, descrizione_tipologia, anno, semestre, compravendita_min, compravendita_max'
      });
    }

    console.log(`[CTRL-IMPORT] insertManuale: zona ${zona_codice}`);
    const result = await ImportModel.insertManuale(req.body);
    res.status(201).json({ success: true, affected: result.affectedRows });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/ntn
 * Upload e importazione CSV con dati NTN (volumi transazioni).
 */
async function importNTN(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

  console.log(`[CTRL-IMPORT] importNTN: ${req.file.originalname}`);
  const { separatore = ';' } = req.body;

  const parsed = parseCSV(req.file.buffer, separatore);

  try {
    const result = await ImportModel.importaCSVNTN(req.file.originalname, parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/zone
 * Upload e importazione CSV con definizioni zone OMI (feature Hinterland).
 * Colonne attese: link_zona, descrizione_zona, comune, fascia, tipologia.
 * Imposta area='CAGLIARI' se comune='Cagliari', altrimenti 'HINTERLAND'.
 */
async function importZone(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

  console.log(`[CTRL-IMPORT] importZone: ${req.file.originalname}`);
  const { separatore = ';' } = req.body;

  const parsed = parseCSV(req.file.buffer, separatore);

  try {
    const result = await ImportModel.importaCSVZone(req.file.originalname, parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/cartella
 * Importa tutti i CSV dalla cartella DATI_HINTERLAND sul server.
 * La path base viene letta dalla variabile d'ambiente DATI_OMI_PATH.
 */
async function importCartella(req, res, next) {
  const cartellaBase = process.env.DATI_OMI_PATH;
  if (!cartellaBase) {
    return res.status(500).json({ error: 'DATI_OMI_PATH non configurato nel file .env' });
  }

  console.log(`[CTRL-IMPORT] importCartella: ${cartellaBase}`);
  try {
    const result = await ImportModel.importaCartellaOMI(cartellaBase);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/omi-semestrale-zone
 * Upload del file ZONE.csv ufficiale OMI (formato Agenzia delle Entrate).
 * Valida che tutti i dati siano della provincia CA — righe di altre province
 * vengono saltate e conteggiate nel report. Anno e semestre vengono estratti
 * automaticamente dalla riga di metadati del file.
 */
async function importOMIZone(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

  console.log(`[CTRL-IMPORT] importOMIZone: ${req.file.originalname}, ${req.file.size} bytes`);
  try {
    const result = await ImportModel.importaOMISemestraleZone(
      req.file.originalname,
      req.file.buffer
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/import/omi-semestrale-valori
 * Upload del file VALORI.csv ufficiale OMI (formato Agenzia delle Entrate).
 * Anno e semestre vengono estratti dalla riga di metadati (es. "Semestre 2025/2").
 * Righe di province diverse da CA vengono saltate e riportate nel risultato.
 */
async function importOMIValori(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

  console.log(`[CTRL-IMPORT] importOMIValori: ${req.file.originalname}, ${req.file.size} bytes`);
  try {
    const result = await ImportModel.importaOMISemestraleValori(
      req.file.originalname,
      req.file.buffer
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/import/log
 * Storico delle importazioni effettuate.
 */
async function getLog(req, res, next) {
  try {
    const { limit = 20 } = req.query;
    const logs = await ImportModel.getImportLog(parseInt(limit));
    console.log(`[CTRL-IMPORT] Log: ${logs.length} record`);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/import/stats
 * Statistiche generali del database OMI.
 */
async function getStats(req, res, next) {
  try {
    const stats = await ImportModel.getStatsDatabase();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadMiddleware,
  template,
  importCSV,
  insertManuale,
  importNTN,
  importZone,
  importCartella,
  importOMIZone,
  importOMIValori,
  getLog,
  getStats,
};
