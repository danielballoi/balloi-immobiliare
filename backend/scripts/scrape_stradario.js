/**
 * @file scrape_stradario.js
 * @description Script di scraping dello stradario comunale di Cagliari.
 *
 *   Sorgente: https://www.comune.cagliari.it/portale/page/it/stradario
 *   Pattern URL: /stradario_dettaglio?top_cod=N  (1 → 1654)
 *
 *   Per ogni pagina estrae:
 *     - Denominazione via (es. "ABBAZIA (DELL')")
 *     - Quartiere (es. "GENNERUXI")
 *
 *   Poi salva in MySQL → tabella `strade_cagliari`
 *   e prova a collegare ogni quartiere al codice zona OMI corrispondente.
 *
 * USO: node backend/scripts/scrape_stradario.js
 *
 * OPZIONI ENV:
 *   SCRAPE_FROM=1      → codice di partenza (default 1)
 *   SCRAPE_TO=1654     → codice di arrivo (default 1654)
 *   SCRAPE_CONCURRENCY=5 → richieste parallele (default 5)
 *   SCRAPE_DELAY_MS=300  → delay tra i batch (default 300ms)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios    = require('axios');
const cheerio  = require('cheerio');
const mysql    = require('mysql2/promise');

// Aumenta il limite listener per evitare warning con connessioni HTTPS parallele
require('events').EventEmitter.defaultMaxListeners = 30;

// ── Configurazione ────────────────────────────────────────────────────────────
const BASE_URL   = 'https://www.comune.cagliari.it/portale/page/it/stradario_dettaglio?top_cod=';
const FROM       = parseInt(process.env.SCRAPE_FROM)        || 1;
const TO         = parseInt(process.env.SCRAPE_TO)          || 1654;
const CONCURRENCY= parseInt(process.env.SCRAPE_CONCURRENCY) || 5;
const DELAY_MS   = parseInt(process.env.SCRAPE_DELAY_MS)    || 300;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'omi',
  port:     parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit:    10,
});

// ── Utilità ───────────────────────────────────────────────────────────────────

/** Aspetta N millisecondi */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Estrae il testo che segue un <strong>Label:</strong> all'interno di un tag <p>.
 * Strategia: cerca il nodo testo direttamente dopo il <strong> trovato.
 *
 * @param {CheerioAPI} $    - istanza cheerio
 * @param {Cheerio}    pTag - il tag <p> che contiene i dati
 * @param {string}     label - es. "Denominazione:"
 * @returns {string} testo pulito o stringa vuota
 */
function estraiCampo($, pTag, label) {
  let valore = '';
  // Itero su tutti i nodi del <p>
  pTag.contents().each((i, node) => {
    // Quando trovo il <strong> col testo uguale a label, il nodo SUCCESSIVO
    // (testo) è il valore che voglio
    if (node.type === 'tag' && node.name === 'strong') {
      const testoStrong = $(node).text().trim();
      if (testoStrong === label) {
        // Il valore è nel nodo testo successivo
        const next = node.nextSibling;
        if (next && next.type === 'text') {
          valore = next.data.trim();
        }
      }
    }
  });
  return valore;
}

/**
 * Scarica e analizza una singola pagina stradario.
 * Ritorna { via, quartiere } oppure null se la pagina non ha dati validi.
 *
 * @param {number} id - top_cod da 1 a 1654
 */
async function scrapePagina(id) {
  try {
    const resp = await axios.get(`${BASE_URL}${id}`, {
      timeout: 12000,
      headers: { 'User-Agent': USER_AGENT },
    });

    const $ = cheerio.load(resp.data);

    // La struttura del sito: .titolo-sezione appare due volte:
    //   [0] = header descrittivo generale dello stradario (da ignorare)
    //   [1] = dati della via specifica (quella che ci serve)
    // Usiamo l'ultimo .titolo-sezione o quello che contiene "Denominazione:"
    const sezioni = $('.titolo-sezione');
    if (sezioni.length < 2) return null;

    // Prendiamo il secondo (index 1) che contiene i dati della via
    const sezione = $(sezioni[1]);
    const pDati = sezione.find('p').first();
    if (!pDati.length) return null;

    const denominazione = estraiCampo($, pDati, 'Denominazione:');
    const quartiere     = estraiCampo($, pDati, 'Quartiere:');

    // Pagina vuota o codice non esistente
    if (!denominazione || !quartiere) return null;

    return {
      via:       denominazione.trim().toUpperCase(),
      quartiere: quartiere.trim().toUpperCase(),
    };

  } catch (err) {
    // Distinguo timeout da altri errori
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      console.warn(`[SCRAPER] Timeout su id=${id}, salto`);
    }
    // Qualsiasi altro errore: non blocca il batch, loggo e restituisco null
    return null;
  }
}

/**
 * Dato un nome quartiere (es. "VILLANOVA"), trova il link_zona OMI corrispondente
 * cercando nella tabella omi_zone una corrispondenza parziale sulla descrizione.
 *
 * Il matching è "best effort": se non trovato restituisce null (non blocca l'import).
 *
 * @param {mysql.Pool}  pool
 * @param {string}      quartiere
 * @returns {Promise<string|null>}
 */
async function trovaLinkZona(pool, quartiere) {
  const [rows] = await pool.query(
    `SELECT link_zona FROM omi_zone
     WHERE UPPER(descrizione_zona) LIKE ?
       AND (comune = 'Cagliari' OR area = 'CAGLIARI')
     LIMIT 1`,
    [`%${quartiere}%`]
  );
  return rows.length ? rows[0].link_zona : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[SCRAPER] Avvio scraping stradario Cagliari');
  console.log(`[SCRAPER] Pagine: ${FROM} → ${TO} | Concorrenza: ${CONCURRENCY} | Delay: ${DELAY_MS}ms`);

  // Crea la tabella se non esiste
  await pool.query(`
    CREATE TABLE IF NOT EXISTS strade_cagliari (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      via          VARCHAR(200) NOT NULL,
      quartiere    VARCHAR(100) NOT NULL,
      link_zona    VARCHAR(20)  DEFAULT NULL,
      top_cod      INT          DEFAULT NULL,
      data_scraping TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_via (via)
    )
  `);
  console.log('[SCRAPER] Tabella strade_cagliari pronta');

  // Cache quartiere → link_zona per ridurre le query al DB
  // (molte vie hanno lo stesso quartiere)
  const cacheZone = {};

  let importate = 0;
  let saltate   = 0;
  let errori    = 0;

  // Processo i codici in batch per non sovraccaricare il server
  for (let i = FROM; i <= TO; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, TO + 1); j++) {
      batch.push(j);
    }

    // Scarico le pagine del batch in parallelo
    const risultati = await Promise.all(batch.map(id => scrapePagina(id).then(r => ({ id, ...r }))));

    for (const r of risultati) {
      if (!r.via || !r.quartiere) {
        saltate++;
        continue;
      }

      // Trovo link_zona dalla cache o dal DB
      if (!(r.quartiere in cacheZone)) {
        cacheZone[r.quartiere] = await trovaLinkZona(pool, r.quartiere);
      }
      const linkZona = cacheZone[r.quartiere];

      try {
        // INSERT IGNORE: se la via esiste già non dà errore, la salta
        await pool.query(
          `INSERT IGNORE INTO strade_cagliari (via, quartiere, link_zona, top_cod)
           VALUES (?, ?, ?, ?)`,
          [r.via, r.quartiere, linkZona, r.id]
        );
        importate++;
      } catch (dbErr) {
        console.error(`[SCRAPER] Errore DB per via="${r.via}": ${dbErr.message}`);
        errori++;
      }
    }

    // Log progresso ogni 50 via
    const completate = i + CONCURRENCY - FROM;
    if (completate % 50 < CONCURRENCY) {
      const pct = Math.round((completate / (TO - FROM + 1)) * 100);
      console.log(`[SCRAPER] Progresso: ${Math.min(i + CONCURRENCY - 1, TO)}/${TO} (${pct}%) | Importate: ${importate} | Saltate: ${saltate}`);
    }

    // Pausa tra i batch per rispettare il server
    await sleep(DELAY_MS);
  }

  console.log(`[SCRAPER] ✅ Completato!`);
  console.log(`[SCRAPER] Importate: ${importate} | Saltate (vuote): ${saltate} | Errori DB: ${errori}`);

  // Aggiorna le vie che non avevano link_zona (ricalcolo con fuzzy matching)
  const [senzaZona] = await pool.query(
    `SELECT DISTINCT quartiere FROM strade_cagliari WHERE link_zona IS NULL`
  );
  if (senzaZona.length > 0) {
    console.log(`[SCRAPER] Cerco zone OMI per ${senzaZona.length} quartieri senza match...`);
    for (const { quartiere } of senzaZona) {
      const lz = await trovaLinkZona(pool, quartiere);
      if (lz) {
        await pool.query(
          `UPDATE strade_cagliari SET link_zona = ? WHERE quartiere = ?`,
          [lz, quartiere]
        );
        console.log(`[SCRAPER]   ${quartiere} → ${lz}`);
      } else {
        console.warn(`[SCRAPER]   ${quartiere} → nessuna zona OMI trovata`);
      }
    }
  }

  await pool.end();
  console.log('[SCRAPER] Pool DB chiuso. Fine.');
}

main().catch(err => {
  console.error('[SCRAPER] Errore fatale:', err.message);
  process.exit(1);
});
