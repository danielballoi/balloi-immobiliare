/**
 * @file Strade.js
 * @description Model per la tabella strade_cagliari.
 *   Contiene SOLO query SQL — nessuna logica HTTP.
 *   Dati caricati tramite scripts/scrape_stradario.js
 *   Mapping quartieri → zone OMI via scripts/aggiorna_mapping_quartieri.js
 *
 * @author Balloi Immobiliare Dev
 */

const { pool } = require('../config/db');

// ── Prefissi stradali da normalizzare prima della ricerca ─────────────────────
// Se l'utente digita "Via Roma" cerchiamo "ROMA" nel DB (non "VIA ROMA"),
// perché la colonna `via` contiene solo la denominazione (es. "ROMA")
// senza il prefisso topografico.
const PREFISSI_STRADALI = [
  'VIALE ', 'VIA ', 'VICINALE ', 'VICOLO ', 'VICO ',
  'PIAZZA ', 'PIAZZALE ', 'PIAZZETTA ',
  'CORSO ', 'CONTRADA ', 'CIRCONVALLAZIONE ',
  'LARGO ', 'LUNGOMARE ', 'LOCALITÀ ', 'LOCALITA ',
  'SALITA ', 'STRADA ', 'SCALINATA ', 'TRAVERSA ',
  'BORGATA ', 'BORGONUOVO ',
];

// ── Articoli determinativi italiani ───────────────────────────────────────────
// Il DB usa il formato INVERTITO: "LIBELLULE (DELLE)" non "DELLE LIBELLULE".
// Quindi "Via delle Libellule" → strip "Via " → "DELLE LIBELLULE"
// → strip "DELLE " → "LIBELLULE" → trova "LIBELLULE (DELLE)" ✓
//
// Ordine importante: gli articoli più lunghi prima per evitare match parziali
// (es. "DEGLI" prima di "DEI", "DELL'" prima di "DEL").
const ARTICOLI_ITALIANI = [
  "DELL'", "DEGLI ", 'DELLE ', 'DELLA ', 'DELLO ',
  'DEI ', 'DEL ', "ALL'", 'AGLI ', 'ALLE ', 'ALLA ',
  'ALLO ', 'AI ', 'AL ', 'IL ', 'LO ', 'LA ', 'LE ',
  'GLI ', 'I ', 'UN ', 'UNA ',
];

/**
 * Normalizza la query di ricerca:
 *   1. Uppercase
 *   2. Rimuove il prefisso stradale (VIA, VIALE, PIAZZA…)
 *   3. Rimuove l'articolo iniziale (DELLE, DEI, DEL, DELL'…)
 *
 * Esempi:
 *   "Via Roma"           → "ROMA"
 *   "Via delle Libellule"→ "LIBELLULE"  (trova "LIBELLULE (DELLE)")
 *   "Via dei Grilli"     → "GRILLI"     (trova "GRILLI (DEI)")
 *   "Viale Diaz"         → "DIAZ"
 *   "Piazza Yenne"       → "YENNE"
 *
 * @param {string} q - testo grezzo dall'utente
 * @returns {string} testo normalizzato
 */
function normalizzaQuery(q) {
  let s = q.trim().toUpperCase();

  // Step 1: rimuove prefisso stradale
  for (const p of PREFISSI_STRADALI) {
    if (s.startsWith(p)) {
      s = s.slice(p.length).trim();
      break;
    }
  }

  // Step 2: rimuove articolo italiano iniziale
  // (solo se rimane ancora qualcosa di significativo dopo)
  for (const art of ARTICOLI_ITALIANI) {
    if (s.startsWith(art)) {
      const senzaArticolo = s.slice(art.length).trim();
      // Assicura che ciò che rimane abbia almeno 2 caratteri
      if (senzaArticolo.length >= 2) {
        s = senzaArticolo;
      }
      break;
    }
  }

  return s;
}

/**
 * Cerca vie per autocomplete.
 * Strategia a doppio step:
 *   1. Vie che INIZIANO con il testo cercato (rilevanza alta, mostrate prime)
 *   2. Vie che CONTENGONO il testo cercato (rilevanza media, aggiunte dopo)
 *
 * Il JOIN con omi_zone porta il nome leggibile della zona OMI (es.
 * "PIRRI CENTRO - MONREALE - SANTA MARIA CHIARA") da mostrare nel frontend.
 * La TRIM(BOTH '''') serve perché le descrizioni sono salvate con apici: 'NOME'
 *
 * @param {string} q     - testo digitato (es. "Via Roma" o "Roma")
 * @param {number} limit - max risultati (default 15)
 * @returns {Promise<Array<{via, quartiere, link_zona, zona_nome}>>}
 */
async function searchStrade(q, limit = 15) {
  const qNorm = normalizzaQuery(q);
  console.log(`[MODEL-STRADE] searchStrade: q="${q}" → normalizzato="${qNorm}"`);

  if (!qNorm || qNorm.length < 2) return [];

  const [rows] = await pool.query(
    `(
       -- Step 1: denominazioni che INIZIANO con la query (più rilevanti)
       SELECT
         s.via,
         s.quartiere,
         s.link_zona,
         TRIM(BOTH '''' FROM z.descrizione_zona) AS zona_nome,
         1 AS rilevanza
       FROM strade_cagliari s
       LEFT JOIN omi_zone z
         ON TRIM(s.link_zona) = TRIM(z.link_zona)
        AND (z.area = 'CAGLIARI' OR z.comune = 'Cagliari')
       WHERE s.via LIKE ?
       ORDER BY s.via
       LIMIT ?
     )
     UNION
     (
       -- Step 2: denominazioni che CONTENGONO la query (rilevanza minore)
       SELECT
         s.via,
         s.quartiere,
         s.link_zona,
         TRIM(BOTH '''' FROM z.descrizione_zona) AS zona_nome,
         2 AS rilevanza
       FROM strade_cagliari s
       LEFT JOIN omi_zone z
         ON TRIM(s.link_zona) = TRIM(z.link_zona)
        AND (z.area = 'CAGLIARI' OR z.comune = 'Cagliari')
       WHERE s.via LIKE ? AND s.via NOT LIKE ?
       ORDER BY s.via
       LIMIT ?
     )
     ORDER BY rilevanza, via
     LIMIT ?`,
    [
      `${qNorm}%`,   // inizia con (step 1)
      limit,
      `%${qNorm}%`,  // contiene (step 2)
      `${qNorm}%`,   // esclude duplicati già trovati nello step 1
      limit,
      limit,
    ]
  );

  return rows;
}

/**
 * Recupera tutte le vie di un quartiere specifico.
 * Utile per mostrare il dettaglio quando l'utente seleziona una zona.
 *
 * @param {string} quartiere - es. "GENNERUXI"
 * @returns {Promise<Array>}
 */
async function getVieByQuartiere(quartiere) {
  console.log(`[MODEL-STRADE] getVieByQuartiere: quartiere="${quartiere}"`);

  const [rows] = await pool.query(
    `SELECT via, quartiere, link_zona
     FROM strade_cagliari
     WHERE UPPER(quartiere) = UPPER(?)
     ORDER BY via`,
    [quartiere]
  );
  return rows;
}

/**
 * Lista quartieri distinti con conteggio vie e nome zona OMI.
 * MAX(link_zona) per compatibilità MySQL strict mode (only_full_group_by).
 *
 * @returns {Promise<Array<{quartiere, n_vie, link_zona, zona_nome}>>}
 */
async function getQuartieriConVie() {
  console.log('[MODEL-STRADE] getQuartieriConVie');

  const [rows] = await pool.query(
    `SELECT
       s.quartiere,
       COUNT(*)  AS n_vie,
       MAX(s.link_zona) AS link_zona,
       TRIM(BOTH '''' FROM z.descrizione_zona) AS zona_nome
     FROM strade_cagliari s
     LEFT JOIN omi_zone z
       ON TRIM(s.link_zona) = TRIM(z.link_zona)
      AND (z.area = 'CAGLIARI' OR z.comune = 'Cagliari')
     GROUP BY s.quartiere
     ORDER BY s.quartiere`
  );
  return rows;
}

/** Conta le vie nel DB — per verificare se lo scraping è stato eseguito */
async function countStrade() {
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM strade_cagliari`);
  return n;
}

module.exports = { searchStrade, getVieByQuartiere, getQuartieriConVie, countStrade };
