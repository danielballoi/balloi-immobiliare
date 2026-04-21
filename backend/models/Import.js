/**
 * @file Import.js
 * @description Model per le operazioni di import dati OMI.
 *   Contiene tutta la logica di parsing CSV e inserimento in DB.
 *   Il controller gestisce solo upload del file e risposta HTTP.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { pool } = require('../config/db');
const fs   = require('fs');
const path = require('path');
const Papa = require('papaparse');

// ── Funzione helper: normalizza un numero dal formato CSV italiano ───────────
// I CSV OMI usano la virgola come decimale e il punto come separatore migliaia.
// Es: "1.500,50" → 1500.50
function parseNumeroCSV(val) {
  if (!val || String(val).trim() === '') return null;
  const normalized = String(val).trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Importa un array di righe CSV nella tabella omi_valori (prezzi).
 * Usa transazione MySQL per garantire atomicità (tutto o niente).
 *
 * @param {string}   filename - Nome del file CSV originale (per il log)
 * @param {Array}    righe    - Array di oggetti (colonne normalizzate a lowercase)
 * @returns {Promise<Object>} { log_id, righe_totali, righe_importate, righe_errore, stato, errori_campione }
 */
async function importaCSVValori(filename, righe) {
  console.log(`[MODEL-IMPORT] importaCSVValori: ${filename}, ${righe.length} righe`);

  // Crea record nel log di import (stato: processing)
  const [logResult] = await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, stato)
    VALUES (?, 'Import CSV', ?, 'processing')
  `, [filename, righe.length]);
  const logId = logResult.insertId;

  const errori = [];
  let righe_importate = 0;
  let righe_errore = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    console.log(`[MODEL-IMPORT] Transazione avviata - log ID: ${logId}`);

    for (let i = 0; i < righe.length; i++) {
      const riga = righe[i];
      try {
        // Gestisce diverse varianti di nomi colonna nei CSV OMI
        const zona_codice = (riga.zona_codice || riga.codice_zona || riga.link_zona || '').trim();
        const descrizione_tipologia = (riga.descrizione_tipologia || riga.tipologia || '').trim();
        const stato = (riga.stato || 'NORMALE').trim().toUpperCase();
        const anno = parseInt(riga.anno);
        const semestre = parseInt(riga.semestre);
        const compravendita_min = parseNumeroCSV(riga.compravendita_min);
        const compravendita_max = parseNumeroCSV(riga.compravendita_max);
        const locazione_min = parseNumeroCSV(riga.locazione_min);
        const locazione_max = parseNumeroCSV(riga.locazione_max);

        // Validazione: questi campi sono obbligatori
        if (!zona_codice || !descrizione_tipologia || isNaN(anno) || isNaN(semestre) ||
            compravendita_min === null || compravendita_max === null) {
          throw new Error(`Riga ${i + 2}: campi obbligatori mancanti`);
        }

        // INSERT con ON DUPLICATE KEY per non creare duplicati se si reimporta lo stesso file
        await conn.query(`
          INSERT INTO omi_valori
            (zona_codice, descrizione_tipologia, stato, anno, semestre,
             compr_min, compr_max, loc_min, loc_max)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            compr_min = VALUES(compr_min),
            compr_max = VALUES(compr_max),
            loc_min   = VALUES(loc_min),
            loc_max   = VALUES(loc_max)
        `, [zona_codice, descrizione_tipologia, stato, anno, semestre,
            compravendita_min, compravendita_max, locazione_min, locazione_max]);

        righe_importate++;
      } catch (errRiga) {
        righe_errore++;
        errori.push(errRiga.message);
        // Logga solo i primi 20 errori per non riempire la console
        if (errori.length <= 20) {
          console.warn(`[MODEL-IMPORT] Errore riga ${i + 2}: ${errRiga.message}`);
        }
      }
    }

    await conn.commit();
    console.log(`[MODEL-IMPORT] CSV completato: ${righe_importate} OK, ${righe_errore} errori`);
  } catch (errTx) {
    await conn.rollback();
    console.error('[MODEL-IMPORT] Rollback transazione:', errTx.message);
    await pool.query('UPDATE import_log SET stato=?, errori=? WHERE id=?', ['error', errTx.message, logId]);
    throw errTx;
  } finally {
    conn.release();
  }

  // Aggiorna il log con il risultato finale
  const statoFinale = righe_errore === 0 ? 'success' : (righe_importate === 0 ? 'error' : 'partial');
  await pool.query(`
    UPDATE import_log
    SET stato=?, righe_importate=?, righe_errore=?, errori=?
    WHERE id=?
  `, [statoFinale, righe_importate, righe_errore, errori.slice(0, 50).join('\n'), logId]);

  return {
    log_id: logId,
    righe_totali: righe.length,
    righe_importate,
    righe_errore,
    stato: statoFinale,
    errori_campione: errori.slice(0, 10),
  };
}

/**
 * Importa un array di righe CSV nella tabella omi_ntn (volumi transazioni).
 *
 * @param {string}   filename - Nome del file CSV originale
 * @param {Array}    righe    - Array di oggetti (colonne normalizzate)
 * @returns {Promise<Object>} Stesso formato di importaCSVValori
 */
async function importaCSVNTN(filename, righe) {
  console.log(`[MODEL-IMPORT] importaCSVNTN: ${filename}, ${righe.length} righe`);

  const [logResult] = await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, stato)
    VALUES (?, 'Import NTN', ?, 'processing')
  `, [filename, righe.length]);
  const logId = logResult.insertId;

  const errori = [];
  let righe_importate = 0;
  let righe_errore = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (let i = 0; i < righe.length; i++) {
      const r = righe[i];
      try {
        // Gestisce varianti nomi colonna nei diversi file NTN dell'Agenzia delle Entrate
        const zona_codice = (r.link_zona || r.zona_codice || r.codice_zona || '').trim();
        const tipo        = (r.descrizione_tipologia || r.tipologia || r.tipo_immobile || '').trim();
        const anno        = parseInt(r.anno);
        const semestre    = String(r.semestre || '1').trim();
        const ntn_compr   = parseNumeroCSV(r.ntn_compravendita || r.ntn_compr || r.ntn || null);
        const ntn_loc     = parseNumeroCSV(r.ntn_locazione     || r.ntn_loc  || null);
        const comune      = (r.comune || 'Cagliari').trim();
        const fascia      = (r.fascia || '').trim();

        if (!zona_codice || !tipo || isNaN(anno)) {
          throw new Error(`Riga ${i + 2}: zona_codice, tipologia e anno sono obbligatori`);
        }

        await conn.query(`
          INSERT INTO omi_ntn (comune, zona_codice, fascia, descrizione_tipologia, anno, semestre, ntn_compravendita, ntn_locazione)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            ntn_compravendita = VALUES(ntn_compravendita),
            ntn_locazione     = VALUES(ntn_locazione)
        `, [comune, zona_codice, fascia, tipo, anno, semestre, ntn_compr, ntn_loc]);

        righe_importate++;
      } catch (errRiga) {
        righe_errore++;
        errori.push(errRiga.message);
        if (errori.length <= 20) console.warn(`[MODEL-IMPORT] Errore NTN riga ${i + 2}: ${errRiga.message}`);
      }
    }

    await conn.commit();
    console.log(`[MODEL-IMPORT] NTN completato: ${righe_importate} OK, ${righe_errore} errori`);
  } catch (errTx) {
    await conn.rollback();
    await pool.query('UPDATE import_log SET stato=?, errori=? WHERE id=?', ['error', errTx.message, logId]);
    throw errTx;
  } finally {
    conn.release();
  }

  const statoFinale = righe_errore === 0 ? 'success' : (righe_importate === 0 ? 'error' : 'partial');
  await pool.query(`
    UPDATE import_log SET stato=?, righe_importate=?, righe_errore=?, errori=? WHERE id=?
  `, [statoFinale, righe_importate, righe_errore, errori.slice(0, 50).join('\n'), logId]);

  return {
    log_id: logId,
    righe_totali: righe.length,
    righe_importate,
    righe_errore,
    stato: statoFinale,
    errori_campione: errori.slice(0, 10),
  };
}

/**
 * Importa definizioni di zone (omi_zone) da un CSV.
 * Feature Hinterland: permette di aggiungere zone di comuni diversi da Cagliari.
 *
 * Logica area: se comune='Cagliari' → area='CAGLIARI', altrimenti → area='HINTERLAND'.
 *
 * @param {string}   filename - Nome del file CSV originale
 * @param {Array}    righe    - Array di oggetti (colonne normalizzate)
 * @returns {Promise<Object>} Risultato import con statistiche
 */
async function importaCSVZone(filename, righe) {
  console.log(`[MODEL-IMPORT] importaCSVZone: ${filename}, ${righe.length} righe`);

  const [logResult] = await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, stato)
    VALUES (?, 'Import Zone', ?, 'processing')
  `, [filename, righe.length]);
  const logId = logResult.insertId;

  const errori = [];
  let righe_importate = 0;
  let righe_errore = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (let i = 0; i < righe.length; i++) {
      const r = righe[i];
      try {
        // Gestisce varianti nomi colonna nel CSV zone
        const link_zona        = (r.link_zona || r.codice_zona || r.zona_codice || '').trim();
        const descrizione_zona = (r.descrizione_zona || r.descrizione || r.nome_zona || '').trim();
        const comune           = (r.comune || 'Cagliari').trim();
        const fascia           = (r.fascia || '').trim();
        const tipologia        = (r.tipologia || '').trim();

        if (!link_zona || !descrizione_zona) {
          throw new Error(`Riga ${i + 2}: link_zona e descrizione_zona sono obbligatori`);
        }

        // Imposta area automaticamente: Cagliari città o hinterland?
        const area = comune.toLowerCase() === 'cagliari' ? 'CAGLIARI' : 'HINTERLAND';

        await conn.query(`
          INSERT INTO omi_zone (link_zona, descrizione_zona, comune, fascia, tipologia, area)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            descrizione_zona = VALUES(descrizione_zona),
            comune           = VALUES(comune),
            fascia           = VALUES(fascia),
            tipologia        = VALUES(tipologia),
            area             = VALUES(area)
        `, [link_zona, descrizione_zona, comune, fascia, tipologia, area]);

        righe_importate++;
      } catch (errRiga) {
        righe_errore++;
        errori.push(errRiga.message);
        if (errori.length <= 20) console.warn(`[MODEL-IMPORT] Errore Zone riga ${i + 2}: ${errRiga.message}`);
      }
    }

    await conn.commit();
    console.log(`[MODEL-IMPORT] Zone completato: ${righe_importate} OK, ${righe_errore} errori`);
  } catch (errTx) {
    await conn.rollback();
    await pool.query('UPDATE import_log SET stato=?, errori=? WHERE id=?', ['error', errTx.message, logId]);
    throw errTx;
  } finally {
    conn.release();
  }

  const statoFinale = righe_errore === 0 ? 'success' : (righe_importate === 0 ? 'error' : 'partial');
  await pool.query(`
    UPDATE import_log SET stato=?, righe_importate=?, righe_errore=?, errori=? WHERE id=?
  `, [statoFinale, righe_importate, righe_errore, errori.slice(0, 50).join('\n'), logId]);

  return {
    log_id: logId,
    righe_totali: righe.length,
    righe_importate,
    righe_errore,
    stato: statoFinale,
    errori_campione: errori.slice(0, 10),
  };
}

/**
 * Inserisce manualmente un singolo record in omi_valori.
 *
 * @param {Object} dati - Dati del record da inserire
 * @returns {Promise<Object>} Risultato MySQL (affectedRows)
 */
async function insertManuale(dati) {
  const {
    zona_codice, descrizione_tipologia, stato = 'NORMALE',
    anno, semestre, compravendita_min, compravendita_max,
    locazione_min, locazione_max,
  } = dati;

  console.log(`[MODEL-IMPORT] insertManuale: zona ${zona_codice}, ${anno}S${semestre}`);

  const [result] = await pool.query(`
    INSERT INTO omi_valori
      (zona_codice, descrizione_tipologia, stato, anno, semestre,
       compr_min, compr_max, loc_min, loc_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      compr_min = VALUES(compr_min),
      compr_max = VALUES(compr_max),
      loc_min   = VALUES(loc_min),
      loc_max   = VALUES(loc_max)
  `, [zona_codice, descrizione_tipologia, stato, parseInt(anno), parseInt(semestre),
      parseFloat(compravendita_min), parseFloat(compravendita_max),
      locazione_min ? parseFloat(locazione_min) : null,
      locazione_max ? parseFloat(locazione_max) : null]);

  // Registra nel log
  await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, righe_importate, stato)
    VALUES ('Inserimento manuale', 'Manuale', 1, 1, 'success')
  `);

  return result;
}

/**
 * Recupera lo storico degli import effettuati.
 *
 * @param {number} limit - Numero massimo di record (default 20)
 * @returns {Promise<Array>} Lista import log
 */
async function getImportLog(limit = 20) {
  const [rows] = await pool.query(`
    SELECT id, filename, tipo, righe_totali, righe_importate, righe_errore,
           stato, data_import
    FROM import_log
    ORDER BY data_import DESC
    LIMIT ?
  `, [parseInt(limit)]);
  return rows;
}

/**
 * Statistiche generali del database OMI.
 *
 * @returns {Promise<Object>} { totale_valori, totale_zone, anni_disponibili }
 */
async function getStatsDatabase() {
  const [[totaleValori]] = await pool.query('SELECT COUNT(*) AS totale FROM omi_valori');
  const [[totaleZone]]   = await pool.query('SELECT COUNT(*) AS totale FROM omi_zone');
  const [anni]           = await pool.query('SELECT DISTINCT anno FROM omi_valori ORDER BY anno DESC LIMIT 5');
  return {
    totale_valori: totaleValori.totale,
    totale_zone:   totaleZone.totale,
    anni_disponibili: anni.map(r => r.anno),
  };
}

/**
 * Normalizza intestazioni CSV nel formato OMI ufficiale.
 * PapaParse usa già transformHeader, ma qui gestiamo varianti extra.
 */
function normHeader(h) {
  return h.trim().toLowerCase().replace(/[\s\-\/]+/g, '_');
}

/**
 * Helper: legge e parsa un file CSV dal filesystem.
 * @param {string} filePath - Percorso assoluto del file
 * @returns {Array} Array di oggetti riga
 */
function leggiCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  // I CSV OMI ufficiali hanno una riga di metadati come prima riga prima delle intestazioni
  const righe = raw.split('\n');
  const primaRiga = righe[0].trim();
  // Se la prima riga non contiene ';' è metadati → la saltiamo
  const contenuto = primaRiga.includes(';') ? raw : righe.slice(1).join('\n');
  const parsed = Papa.parse(contenuto, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: normHeader,
  });
  return parsed.data;
}

/**
 * Inserisce zone da righe CSV nel formato ufficiale OMI (ZONE.csv).
 * Usa INSERT IGNORE per saltare zone già presenti (dedup su link_zona).
 *
 * @param {Array}  righe      - Righe CSV già parsate
 * @param {Object} conn       - Connessione MySQL
 * @returns {{ importate: number, saltate: number }}
 */
async function _inserisciZoneOMI(righe, conn) {
  let importate = 0;
  let saltate   = 0;

  for (const r of righe) {
    // Colonne del CSV OMI dopo normalizzazione header
    const linkZona   = (r.linkzona || r.link_zona || r.zona_codice || '').trim();
    const zona       = (r.zona     || '').trim();
    const descZona   = (r.zona_descr || r.descrizione_zona || '').trim();
    const comune     = (r.comune_descrizione || r.comune || '').trim().toUpperCase();
    const fascia     = (r.fascia   || '').trim();
    const comuneIst  = (r.comune_istat || '').trim();
    const microzona  = parseInt(r.microzona) || null;
    const tipologia  = (r.cod_tip_prev || r.tipologia || '').trim();

    if (!linkZona || !zona) continue; // riga intestazione o vuota

    const [result] = await conn.query(`
      INSERT IGNORE INTO omi_zone
        (comune_istat, comune, fascia, zona, zona_codice, link_zona, descrizione_zona, microzona, tipologia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [comuneIst, comune, fascia, zona, linkZona, linkZona, descZona, microzona, tipologia]);

    if (result.affectedRows > 0) importate++;
    else saltate++;
  }

  return { importate, saltate };
}

/**
 * Inserisce valori da righe CSV nel formato ufficiale OMI (VALORI.csv).
 * Usa INSERT IGNORE per saltare valori già presenti.
 *
 * @param {Array}  righe    - Righe CSV già parsate
 * @param {number} anno     - Anno ricavato dal nome cartella
 * @param {string} semestre - Semestre nel formato '2024_01'
 * @param {Object} conn     - Connessione MySQL
 * @returns {{ importate: number, saltate: number }}
 */
async function _inserisciValoriOMI(righe, anno, semestre, conn) {
  let importate = 0;
  let saltate   = 0;

  for (const r of righe) {
    const zonaCodice = (r.linkzona || r.link_zona || r.zona_codice || '').trim();
    const fascia     = (r.fascia   || '').trim();
    const tipologia  = (r.cod_tip  || r.tipologia || '').trim();
    const descTip    = (r.descr_tipologia || r.descrizione_tipologia || '').trim();
    const stato      = (r.stato    || 'NORMALE').trim().toUpperCase();
    const comprMin   = parseNumeroCSV(r.compr_min);
    const comprMax   = parseNumeroCSV(r.compr_max);
    const locMin     = parseNumeroCSV(r.loc_min);
    const locMax     = parseNumeroCSV(r.loc_max);
    const superficie = (r.sup_nl_compr || r.superficie || '').trim();

    if (!zonaCodice || !descTip || comprMin === null) continue;

    const [result] = await conn.query(`
      INSERT IGNORE INTO omi_valori
        (zona_codice, fascia, tipologia, descrizione_tipologia, stato,
         compr_min, compr_max, loc_min, loc_max, superficie, anno, semestre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [zonaCodice, fascia, tipologia, descTip, stato,
        comprMin, comprMax, locMin, locMax, superficie, anno, semestre]);

    if (result.affectedRows > 0) importate++;
    else saltate++;
  }

  return { importate, saltate };
}

/**
 * Importa tutti i dati OMI dalla cartella DATI_HINTERLAND.
 * Scansiona le sottocartelle *_PROV, per ognuna importa ZONE.csv e VALORI.csv.
 * Le zone già presenti (per link_zona) vengono saltate — nessun duplicato.
 *
 * @param {string} cartellaBase - Percorso alla cartella DATI_OMI (da .env)
 * @returns {Promise<Object>} Statistiche aggregate
 */
async function importaCartellaOMI(cartellaBase) {
  const cartellaHinterland = path.join(cartellaBase, 'DATI_HINTERLAND');
  console.log(`[MODEL-IMPORT] importaCartellaOMI: ${cartellaHinterland}`);

  if (!fs.existsSync(cartellaHinterland)) {
    throw new Error(`Cartella non trovata: ${cartellaHinterland}`);
  }

  // Lista sottocartelle nel formato YYYY_SS_PROV
  const subdir = fs.readdirSync(cartellaHinterland)
    .filter(d => /^\d{4}_\d{2}_PROV$/.test(d))
    .sort();

  if (subdir.length === 0) {
    throw new Error('Nessuna cartella semestre trovata (formato atteso: YYYY_SS_PROV)');
  }

  const [logResult] = await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, stato)
    VALUES (?, 'Import Hinterland', ?, 'processing')
  `, [`DATI_HINTERLAND (${subdir.length} semestri)`, subdir.length]);
  const logId = logResult.insertId;

  let totZoneImportate  = 0;
  let totZoneSaltate    = 0;
  let totValImportati   = 0;
  let totValSaltati     = 0;
  const errori = [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const cartella of subdir) {
      // Ricava anno e semestre dal nome cartella (es. 2024_01_PROV → anno=2024, sem=2024_01)
      const [annoStr, semNum] = cartella.split('_');
      const anno     = parseInt(annoStr);
      const semestre = `${annoStr}_${semNum}`;

      const dirPath = path.join(cartellaHinterland, cartella);
      const files   = fs.readdirSync(dirPath);

      // Processa TUTTI i file ZONE.csv presenti (gestisce cartelle con più file)
      const zoneFiles = files.filter(f => f.endsWith('_ZONE.csv'));
      for (const zoneFile of zoneFiles) {
        try {
          const righe = leggiCSV(path.join(dirPath, zoneFile));
          const stats = await _inserisciZoneOMI(righe, conn);
          totZoneImportate += stats.importate;
          totZoneSaltate   += stats.saltate;
          console.log(`[MODEL-IMPORT] ${cartella}/${zoneFile} ZONE: ${stats.importate} nuove, ${stats.saltate} saltate`);
        } catch (e) {
          errori.push(`${cartella}/${zoneFile}: ${e.message}`);
          console.warn(`[MODEL-IMPORT] Errore ZONE ${cartella}/${zoneFile}: ${e.message}`);
        }
      }

      // Processa TUTTI i file VALORI.csv presenti
      const valFiles = files.filter(f => f.endsWith('_VALORI.csv'));
      for (const valFile of valFiles) {
        try {
          const righe = leggiCSV(path.join(dirPath, valFile));
          const stats = await _inserisciValoriOMI(righe, anno, semestre, conn);
          totValImportati += stats.importate;
          totValSaltati   += stats.saltate;
          console.log(`[MODEL-IMPORT] ${cartella}/${valFile} VALORI: ${stats.importate} nuovi, ${stats.saltate} saltati`);
        } catch (e) {
          errori.push(`${cartella}/${valFile}: ${e.message}`);
          console.warn(`[MODEL-IMPORT] Errore VALORI ${cartella}/${valFile}: ${e.message}`);
        }
      }
    }

    await conn.commit();
    console.log(`[MODEL-IMPORT] Hinterland completato: zone +${totZoneImportate} (${totZoneSaltate} skip), valori +${totValImportati} (${totValSaltati} skip)`);
  } catch (errTx) {
    await conn.rollback();
    await pool.query('UPDATE import_log SET stato=?, errori=? WHERE id=?', ['error', errTx.message, logId]);
    throw errTx;
  } finally {
    conn.release();
  }

  const stato = errori.length === 0 ? 'success' : 'partial';
  await pool.query(`
    UPDATE import_log
    SET stato=?, righe_importate=?, righe_errore=?, errori=?
    WHERE id=?
  `, [stato, totZoneImportate + totValImportati, errori.length,
      errori.slice(0, 50).join('\n'), logId]);

  return {
    log_id: logId,
    semestri_processati: subdir.length,
    zone_importate:  totZoneImportate,
    zone_saltate:    totZoneSaltate,
    valori_importati: totValImportati,
    valori_saltati:   totValSaltati,
    stato,
    errori_campione: errori.slice(0, 10),
  };
}

/**
 * Parsa un buffer CSV nel formato ufficiale OMI (riga 1 = metadati, riga 2 = intestazioni).
 * Restituisce anno, semestre e le righe dati.
 *
 * @param {Buffer} buffer - Contenuto del file CSV
 * @returns {{ annoRilevato: number|null, semestreRilevato: number|null, righe: Array }}
 */
function _parseOMIBuffer(buffer) {
  const raw = buffer.toString('utf-8');
  const lines = raw.split('\n');
  const metadataRow = lines[0].trim();

  // "Quotazioni Immobiliari : ... - Semestre 2025/2 - elaborazione del ..."
  const matchSem = metadataRow.match(/Semestre\s+(\d{4})\/(\d)/i);
  const annoRilevato     = matchSem ? parseInt(matchSem[1]) : null;
  const semestreRilevato = matchSem ? parseInt(matchSem[2]) : null;

  // Salta riga 1 metadati, usa riga 2 come intestazioni
  const csvContent = lines.slice(1).join('\n');
  const parsed = Papa.parse(csvContent, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/[\s\-\/]+/g, '_'),
  });

  return { annoRilevato, semestreRilevato, righe: parsed.data };
}

/**
 * Importa ZONE.csv nel formato ufficiale OMI (file semestrale dell'Agenzia delle Entrate).
 * Ogni riga deve avere Prov=CA — le righe di altre province vengono saltate e conteggiate.
 * Usa ON DUPLICATE KEY UPDATE: idempotente alla re-importazione dello stesso semestre.
 *
 * @param {string} filename - Nome del file originale (per il log)
 * @param {Buffer} buffer   - Contenuto del file CSV
 * @returns {Promise<Object>} { log_id, anno_rilevato, semestre_rilevato, righe_totali,
 *                              importate, aggiornate, saltate_provincia_errata, saltate_vuote,
 *                              errori_campione, stato }
 */
async function importaOMISemestraleZone(filename, buffer) {
  const { annoRilevato, semestreRilevato, righe } = _parseOMIBuffer(buffer);
  console.log(`[MODEL-IMPORT] importaOMISemestraleZone: ${filename}, ${righe.length} righe, ${annoRilevato}S${semestreRilevato}`);

  const [logResult] = await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, stato)
    VALUES (?, 'OMI Semestrale Zone', ?, 'processing')
  `, [filename, righe.length]);
  const logId = logResult.insertId;

  let importate  = 0;
  let aggiornate = 0;
  let saltate_provincia = 0;
  let saltate_vuote     = 0;
  const errori = [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (let i = 0; i < righe.length; i++) {
      const r = righe[i];

      // Valida provincia: accetta solo CA (Cagliari)
      const prov = (r.prov || '').trim().toUpperCase();
      if (prov !== 'CA') { saltate_provincia++; continue; }

      const linkZona = (r.linkzona || r.link_zona || '').trim();
      const zona     = (r.zona || '').trim();
      if (!linkZona || !zona) { saltate_vuote++; continue; }

      // zona_descr nel CSV ha gli apici: 'MARINA - STAMPACE' → MARINA - STAMPACE
      const descZona   = (r.zona_descr || '').trim().replace(/^'|'$/g, '');
      const comune     = (r.comune_descrizione || '').trim();
      const fascia     = (r.fascia || '').trim();
      const comuneIst  = (r.comune_istat || '').trim();
      const microzona  = parseInt(r.microzona) || null;
      const tipologia  = (r.cod_tip_prev || '').trim();
      const area       = comune.toUpperCase() === 'CAGLIARI' ? 'CAGLIARI' : 'HINTERLAND';

      try {
        const [result] = await conn.query(`
          INSERT INTO omi_zone
            (comune_istat, comune, fascia, zona, zona_codice, link_zona,
             descrizione_zona, microzona, tipologia, area)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            comune_istat     = VALUES(comune_istat),
            comune           = VALUES(comune),
            fascia           = VALUES(fascia),
            descrizione_zona = VALUES(descrizione_zona),
            microzona        = VALUES(microzona),
            tipologia        = VALUES(tipologia),
            area             = VALUES(area)
        `, [comuneIst, comune, fascia, zona, linkZona, linkZona,
            descZona, microzona, tipologia, area]);

        // affectedRows 1 = insert nuovo, 2 = aggiornamento duplicato
        if (result.affectedRows === 1) importate++;
        else aggiornate++;
      } catch (errRiga) {
        errori.push(`Riga ${i + 3}: ${errRiga.message}`);
        if (errori.length <= 20) console.warn(`[MODEL-IMPORT] Zona riga ${i + 3}: ${errRiga.message}`);
      }
    }

    await conn.commit();
    console.log(`[MODEL-IMPORT] OMI Zone: +${importate} nuove, ~${aggiornate} aggiornate, ${saltate_provincia} prov-errata`);
  } catch (errTx) {
    await conn.rollback();
    await pool.query('UPDATE import_log SET stato=?, errori=? WHERE id=?', ['error', errTx.message, logId]);
    throw errTx;
  } finally {
    conn.release();
  }

  const totOk    = importate + aggiornate;
  const stato    = errori.length === 0 ? 'success' : (totOk === 0 ? 'error' : 'partial');
  await pool.query(`
    UPDATE import_log SET stato=?, righe_importate=?, righe_errore=?, errori=? WHERE id=?
  `, [stato, totOk, errori.length + saltate_provincia, errori.slice(0, 50).join('\n'), logId]);

  return {
    log_id:                   logId,
    anno_rilevato:            annoRilevato,
    semestre_rilevato:        semestreRilevato,
    righe_totali:             righe.length,
    importate,
    aggiornate,
    saltate_provincia_errata: saltate_provincia,
    saltate_vuote,
    errori_campione:          errori.slice(0, 10),
    stato,
  };
}

/**
 * Importa VALORI.csv nel formato ufficiale OMI (file semestrale dell'Agenzia delle Entrate).
 * Anno e semestre vengono estratti automaticamente dalla riga di metadati del CSV.
 * Ogni riga deve avere Prov=CA — le righe di altre province vengono saltate.
 * Usa ON DUPLICATE KEY UPDATE: idempotente alla re-importazione dello stesso semestre.
 *
 * @param {string} filename - Nome del file originale (per il log)
 * @param {Buffer} buffer   - Contenuto del file CSV
 * @returns {Promise<Object>} Statistiche import
 */
async function importaOMISemestraleValori(filename, buffer) {
  const { annoRilevato, semestreRilevato, righe } = _parseOMIBuffer(buffer);
  console.log(`[MODEL-IMPORT] importaOMISemestraleValori: ${filename}, ${righe.length} righe, ${annoRilevato}S${semestreRilevato}`);

  if (!annoRilevato || !semestreRilevato) {
    throw new Error(
      'Impossibile ricavare anno/semestre dalla riga di metadati. ' +
      'Verificare che sia un file VALORI.csv OMI ufficiale (riga 1: "... - Semestre YYYY/N - ...").'
    );
  }

  const [logResult] = await pool.query(`
    INSERT INTO import_log (filename, tipo, righe_totali, stato)
    VALUES (?, 'OMI Semestrale Valori', ?, 'processing')
  `, [filename, righe.length]);
  const logId = logResult.insertId;

  let importate  = 0;
  let aggiornate = 0;
  let saltate_provincia = 0;
  let saltate_vuote     = 0;
  const errori = [];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (let i = 0; i < righe.length; i++) {
      const r = righe[i];

      const prov = (r.prov || '').trim().toUpperCase();
      if (prov !== 'CA') { saltate_provincia++; continue; }

      const zonaCodice = (r.linkzona || r.link_zona || '').trim();
      const descTip    = (r.descr_tipologia || '').trim();
      if (!zonaCodice || !descTip) { saltate_vuote++; continue; }

      const comprMin   = parseNumeroCSV(r.compr_min);
      if (comprMin === null) { saltate_vuote++; continue; }

      const fascia     = (r.fascia || '').trim();
      const tipologia  = (r.cod_tip || '').trim();
      const stato      = (r.stato   || 'NORMALE').trim().toUpperCase();
      const comprMax   = parseNumeroCSV(r.compr_max);
      const locMin     = parseNumeroCSV(r.loc_min);
      const locMax     = parseNumeroCSV(r.loc_max);
      const superficie = (r.sup_nl_compr || '').trim();

      try {
        const [result] = await conn.query(`
          INSERT INTO omi_valori
            (zona_codice, fascia, tipologia, descrizione_tipologia, stato,
             compr_min, compr_max, loc_min, loc_max, superficie, anno, semestre)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            compr_min  = VALUES(compr_min),
            compr_max  = VALUES(compr_max),
            loc_min    = VALUES(loc_min),
            loc_max    = VALUES(loc_max),
            superficie = VALUES(superficie),
            fascia     = VALUES(fascia)
        `, [zonaCodice, fascia, tipologia, descTip, stato,
            comprMin, comprMax, locMin, locMax, superficie,
            annoRilevato, semestreRilevato]);

        if (result.affectedRows === 1) importate++;
        else aggiornate++;
      } catch (errRiga) {
        errori.push(`Riga ${i + 3}: ${errRiga.message}`);
        if (errori.length <= 20) console.warn(`[MODEL-IMPORT] Valori riga ${i + 3}: ${errRiga.message}`);
      }
    }

    await conn.commit();
    console.log(`[MODEL-IMPORT] OMI Valori: +${importate} nuovi, ~${aggiornate} aggiornati, ${saltate_provincia} prov-errata`);
  } catch (errTx) {
    await conn.rollback();
    await pool.query('UPDATE import_log SET stato=?, errori=? WHERE id=?', ['error', errTx.message, logId]);
    throw errTx;
  } finally {
    conn.release();
  }

  const totOk = importate + aggiornate;
  const stato = errori.length === 0 ? 'success' : (totOk === 0 ? 'error' : 'partial');
  await pool.query(`
    UPDATE import_log SET stato=?, righe_importate=?, righe_errore=?, errori=? WHERE id=?
  `, [stato, totOk, errori.length + saltate_provincia, errori.slice(0, 50).join('\n'), logId]);

  return {
    log_id:                   logId,
    anno_rilevato:            annoRilevato,
    semestre_rilevato:        semestreRilevato,
    righe_totali:             righe.length,
    importate,
    aggiornate,
    saltate_provincia_errata: saltate_provincia,
    saltate_vuote,
    errori_campione:          errori.slice(0, 10),
    stato,
  };
}

module.exports = {
  importaCSVValori,
  importaCSVNTN,
  importaCSVZone,
  importaCartellaOMI,
  importaOMISemestraleZone,
  importaOMISemestraleValori,
  insertManuale,
  getImportLog,
  getStatsDatabase,
};
