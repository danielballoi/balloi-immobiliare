/**
 * @file aggiorna_mapping_quartieri.js
 * @description Aggiorna il campo link_zona nella tabella strade_cagliari
 *   usando un dizionario hardcoded con la corrispondenza ESATTA tra i nomi
 *   dei quartieri dello stradario comunale e i codici delle zone OMI.
 *
 *   PERCHÉ hardcoded e non fuzzy matching?
 *   Perché i nomi sono molto diversi (es. "MONTELEONE - SANTA ROSALIA"
 *   → "PIRRI CENTRO - MONREALE - SANTA MARIA CHIARA") e il matching
 *   automatico produrrebbe troppi errori. Meglio una mappa controllata.
 *
 * USO: node backend/scripts/aggiorna_mapping_quartieri.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'omi',
  port:     parseInt(process.env.DB_PORT) || 3306,
});

/**
 * Dizionario: nome quartiere stradario → codice link_zona OMI
 *
 * I codici sono quelli della tabella omi_zone per il Comune di Cagliari.
 * Fonti: stradario comunale + dati OMI Agenzia delle Entrate.
 *
 * Quartieri non mappati (null) → non hanno una zona OMI corrispondente
 * (es. aree agricole, zone non censite, vie non ufficiali).
 */
const MAPPING = {
  // ── PIRRI (4 zone distinte nell'OMI) ───────────────────────────────────────
  'BARRACCA MANNA':                        'CA00003348', // PIRRI NORD (BARRACCA MANNA...)
  'SAN GIUSEPPE - SANTA TERESA - PARTEOLLA': 'CA00003348', // PIRRI NORD
  'IS BINGIAS - TERRAMAINI':               'CA00003350', // PIRRI OVEST (IS BINGIAS...)
  'MONREALE':                              'CA00003349', // PIRRI CENTRO - MONREALE - SANTA MARIA CHIARA
  'MONTELEONE - SANTA ROSALIA':            'CA00003349', // PIRRI CENTRO - MONREALE - SANTA MARIA CHIARA

  // ── CAGLIARI NORD-EST ───────────────────────────────────────────────────────
  'BONARIA':                               'CA00003330', // MONTE URPINU - BONARIA
  'MONTE URPINU':                          'CA00003330', // MONTE URPINU - BONARIA
  'GENNERUXI':                             'CA00003331', // GENNERUXI - VIA CASTIGLIONE
  'SAN BENEDETTO':                         'CA00000011', // SAN BENEDETTO - TRIBUNALE - VIA SONNINO
  'QUARTIERE EUROPEO':                     'CA00000011', // SAN BENEDETTO - TRIBUNALE - VIA SONNINO

  // ── CAGLIARI CENTRO-STORICO ─────────────────────────────────────────────────
  'CASTELLO':                              'CA00002237', // CASTELLO
  'MARINA':                                'CA00001562', // MARINA - STAMPACE
  'STAMPACE':                              'CA00001562', // MARINA - STAMPACE
  'TUVIXEDDU - TUVUMANNU':                 'CA00001562', // MARINA - STAMPACE (adiacente)
  'VILLANOVA':                             'CA00000012', // VILLANOVA

  // ── CAGLIARI OVEST ──────────────────────────────────────────────────────────
  'SANT\'AVENDRACE':                       'CA00000014', // SANT'AVENDRACE - SAN MICHELE
  'SAN MICHELE':                           'CA00000014', // SANT'AVENDRACE - SAN MICHELE
  'CEP':                                   'CA00000015', // AMSICORA - MONTE MIXI
  'MONTE MIXI':                            'CA00000015', // AMSICORA - MONTE MIXI
  'IS MIRRIONIS':                          'CA00003347', // IS MIRRIONIS - MONTE CLARO
  'SANT\'ALENIXEDDA':                      'CA00003329', // VIA POLA - VIALE MERELLO - BUONCAMINO
  'MULINU BECCIU':                         'CA00003346', // MULINU BECCIU - FANGARIO - BROTZU

  // ── CAGLIARI NORD-OVEST ─────────────────────────────────────────────────────
  'LA VEGA':                               'CA00003328', // LA VEGA - FONSARDA
  'FONSARDA':                              'CA00003328', // LA VEGA - FONSARDA

  // ── CAGLIARI NORD ───────────────────────────────────────────────────────────
  'LA PALMA':                              'CA00001564', // QUARTIERE DEL SOLE - LA PALMA
  'QUARTIERE DEL SOLE':                    'CA00001564', // QUARTIERE DEL SOLE - LA PALMA

  // ── CAGLIARI EST / LITORALE ─────────────────────────────────────────────────
  'POETTO - MEDAU SU CRAMU':               'CA00003353', // POETTO
  'IS CAMPUS - IS CORRIAS':               'CA00001571', // MEDAU SU CRAMU
  'VILLA DOLORETTA':                       'CA00003351', // LA PLAYA - VIA SAN PAOLO
  'BORGO SANT\'ELIA':                      'CA00003352', // SAN BARTOLOMEO - SANT'ELIA - CALAMOSCA
  'NUOVO BORGO SANT\'ELIA':                'CA00003352', // SAN BARTOLOMEO - SANT'ELIA - CALAMOSCA

  // ── NON MAPPABILI ───────────────────────────────────────────────────────────
  // Questi quartieri non hanno una corrispondenza diretta nelle 22 zone OMI
  '[NON SPECIFICATO]': null,
  'VIE NON UFFICIALI': null,
};

async function main() {
  console.log('[MAPPING] Avvio aggiornamento mapping quartieri → zone OMI');

  // Verifica che la tabella esista e abbia dati
  const [[{ n }]] = await pool.query('SELECT COUNT(*) as n FROM strade_cagliari');
  console.log(`[MAPPING] Vie nella tabella: ${n}`);
  if (n === 0) {
    console.error('[MAPPING] ⚠ Tabella vuota — esegui prima lo scraping!');
    process.exit(1);
  }

  let aggiornate = 0;
  let nonTrovate = [];

  for (const [quartiere, linkZona] of Object.entries(MAPPING)) {
    const [result] = await pool.query(
      `UPDATE strade_cagliari SET link_zona = ? WHERE quartiere = ?`,
      [linkZona, quartiere]
    );
    const n = result.affectedRows;
    if (n > 0) {
      console.log(`[MAPPING] ✓ "${quartiere}" → ${linkZona ?? 'null'} (${n} vie)`);
      aggiornate += n;
    }
  }

  // Controlla se ci sono quartieri rimasti senza mapping
  const [senzaZona] = await pool.query(
    `SELECT DISTINCT quartiere, COUNT(*) as n
     FROM strade_cagliari
     WHERE link_zona IS NULL AND quartiere NOT IN ('[NON SPECIFICATO]', 'VIE NON UFFICIALI')
     GROUP BY quartiere
     ORDER BY n DESC`
  );

  if (senzaZona.length > 0) {
    console.warn('\n[MAPPING] ⚠ Quartieri senza zona OMI:');
    senzaZona.forEach(r => console.warn(`  - "${r.quartiere}" (${r.n} vie)`));
    nonTrovate = senzaZona.map(r => r.quartiere);
  }

  console.log(`\n[MAPPING] ✅ Completato! Vie aggiornate: ${aggiornate}`);
  console.log(`[MAPPING] Quartieri non mappati: ${nonTrovate.length}`);

  await pool.end();
}

main().catch(err => {
  console.error('[MAPPING] Errore:', err.message);
  process.exit(1);
});
