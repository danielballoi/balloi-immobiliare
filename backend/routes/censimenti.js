/**
 * Route /api/censimenti — Censimento immobili personali
 *
 * Ogni utente gestisce i propri immobili registrati manualmente.
 * Ogni operazione è filtrata per user_id (dall'auth JWT).
 *
 *   GET    /         Lista censimenti dell'utente
 *   POST   /         Aggiunge nuovo censimento
 *   PUT    /:id      Aggiorna censimento (solo se owner)
 *   DELETE /:id      Elimina censimento (solo se owner)
 *   PATCH  /:id/stato      Cambia stato_interesse
 *   PATCH  /:id/preferito  Toggle preferito
 */

const router      = require('express').Router();
const requireAuth = require('../middleware/auth');
const { pool }    = require('../config/db');

router.use(requireAuth);

// ── GET / — lista censimenti dell'utente autenticato ─────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM censimenti_immobili WHERE user_id = $1 ORDER BY data_inserimento DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[CENSIMENTI] Errore lista:', err.message);
    res.status(500).json({ error: 'Errore nel recupero censimenti' });
  }
});

// ── POST / — aggiunge nuovo censimento ───────────────────────────────────
router.post('/', async (req, res) => {
  const {
    indirizzo, quartiere, citta, cap, tipologia,
    superficie_mq, prezzo_richiesto, stato_interesse,
    stato_immobile, venditore, note, tipo_acquisizione, link_riferimento,
    data_inizio_asta,
    classe_energetica, esposizione, vista, qualita_costruzione, luminosita,
    stato_conservazione, fascia_omi,
    piano, num_locali, num_bagni, anno_costruzione,
    ascensore, box_auto, balcone_terrazza, giardino,
    prezzo_acquisto, spese_condominiali_mensili, rendita_catastale, imu_annua, tari_annua,
    prezzo_valutato_giusto, rendita_mensile_stimata, rendimento_annuo_stimato_pct,
    giudizio_personale, origine, url_annuncio,
  } = req.body;

  if (!indirizzo) {
    return res.status(400).json({ error: "Inserisci l'indirizzo" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO censimenti_immobili
        (user_id, indirizzo, quartiere, citta, cap, tipologia, superficie_mq,
         prezzo_richiesto, stato_interesse, stato_immobile, venditore, note,
         tipo_acquisizione, link_riferimento, data_inizio_asta,
         classe_energetica, esposizione, vista, qualita_costruzione, luminosita,
         stato_conservazione, fascia_omi,
         piano, num_locali, num_bagni, anno_costruzione,
         ascensore, box_auto, balcone_terrazza, giardino,
         prezzo_acquisto, spese_condominiali_mensili, rendita_catastale, imu_annua, tari_annua,
         prezzo_valutato_giusto, rendita_mensile_stimata, rendimento_annuo_stimato_pct,
         giudizio_personale, origine, url_annuncio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
               $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41)
       RETURNING id`,
      [
        req.user.id,
        indirizzo || null, quartiere || null, citta || null, cap || null,
        tipologia || null, superficie_mq || null, prezzo_richiesto || null,
        stato_interesse || 'INTERESSATO', stato_immobile || null,
        venditore || null, note || null,
        tipo_acquisizione || null, link_riferimento || null, data_inizio_asta || null,
        classe_energetica || null, esposizione || null, vista || null,
        qualita_costruzione || null, luminosita || null,
        stato_conservazione || null, fascia_omi || null,
        piano || null, num_locali || null, num_bagni || null, anno_costruzione || null,
        // Booleani: converti in true/false per PostgreSQL
        Boolean(ascensore), Boolean(box_auto), Boolean(balcone_terrazza), Boolean(giardino),
        prezzo_acquisto || null, spese_condominiali_mensili || null,
        rendita_catastale || null, imu_annua || null, tari_annua || null,
        prezzo_valutato_giusto || null, rendita_mensile_stimata || null,
        rendimento_annuo_stimato_pct || null,
        giudizio_personale || null, origine || 'MANUALE', url_annuncio || null,
      ]
    );
    res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[CENSIMENTI] Errore inserimento:', err.message);
    res.status(500).json({ error: "Errore durante l'inserimento" });
  }
});

// ── PUT /:id — aggiorna censimento (solo owner) ───────────────────────────
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const { rows } = await pool.query(
      'SELECT id FROM censimenti_immobili WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Censimento non trovato' });

    const {
      indirizzo, quartiere, citta, cap, tipologia,
      superficie_mq, prezzo_richiesto, stato_interesse,
      stato_immobile, venditore, note, tipo_acquisizione, link_riferimento,
      data_inizio_asta,
      classe_energetica, esposizione, vista, qualita_costruzione, luminosita,
      stato_conservazione, fascia_omi,
      piano, num_locali, num_bagni, anno_costruzione,
      ascensore, box_auto, balcone_terrazza, giardino,
      prezzo_acquisto, spese_condominiali_mensili, rendita_catastale, imu_annua, tari_annua,
      prezzo_valutato_giusto, rendita_mensile_stimata, rendimento_annuo_stimato_pct,
      giudizio_personale, origine, url_annuncio,
    } = req.body;

    await pool.query(
      `UPDATE censimenti_immobili
       SET indirizzo=$1, quartiere=$2, citta=$3, cap=$4, tipologia=$5,
           superficie_mq=$6, prezzo_richiesto=$7, stato_interesse=$8,
           stato_immobile=$9, venditore=$10, note=$11,
           tipo_acquisizione=$12, link_riferimento=$13, data_inizio_asta=$14,
           classe_energetica=$15, esposizione=$16, vista=$17,
           qualita_costruzione=$18, luminosita=$19, stato_conservazione=$20, fascia_omi=$21,
           piano=$22, num_locali=$23, num_bagni=$24, anno_costruzione=$25,
           ascensore=$26, box_auto=$27, balcone_terrazza=$28, giardino=$29,
           prezzo_acquisto=$30, spese_condominiali_mensili=$31, rendita_catastale=$32,
           imu_annua=$33, tari_annua=$34,
           prezzo_valutato_giusto=$35, rendita_mensile_stimata=$36,
           rendimento_annuo_stimato_pct=$37, giudizio_personale=$38,
           url_annuncio=$39,
           origine=COALESCE($40, origine)
       WHERE id = $41 AND user_id = $42`,
      [
        indirizzo, quartiere || null, citta || null, cap || null, tipologia,
        superficie_mq || null, prezzo_richiesto || null,
        stato_interesse || 'INTERESSATO', stato_immobile || null,
        venditore || null, note || null,
        tipo_acquisizione || null, link_riferimento || null, data_inizio_asta || null,
        classe_energetica || null, esposizione || null, vista || null,
        qualita_costruzione || null, luminosita || null,
        stato_conservazione || null, fascia_omi || null,
        piano || null, num_locali || null, num_bagni || null, anno_costruzione || null,
        // Booleani
        Boolean(ascensore), Boolean(box_auto), Boolean(balcone_terrazza), Boolean(giardino),
        prezzo_acquisto || null, spese_condominiali_mensili || null,
        rendita_catastale || null, imu_annua || null, tari_annua || null,
        prezzo_valutato_giusto || null, rendita_mensile_stimata || null,
        rendimento_annuo_stimato_pct || null, giudizio_personale || null,
        url_annuncio || null,
        origine || null,
        id, req.user.id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore aggiornamento:', err.message);
    res.status(500).json({ error: "Errore durante l'aggiornamento" });
  }
});

// ── PATCH /:id/note — aggiorna solo il campo note (salvataggio rapido) ──
router.patch('/:id/note', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
  const { note } = req.body;
  try {
    const result = await pool.query(
      'UPDATE censimenti_immobili SET note = $1 WHERE id = $2 AND user_id = $3',
      [note ?? null, id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore aggiornamento note:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento note' });
  }
});

// ── PATCH /:id/stato — cambia stato_interesse dell'immobile ─────────────
router.patch('/:id/stato', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  const { stato_interesse } = req.body;
  const statiValidi = ['COMPRATO', 'INTERESSATO', 'VENDUTO_TERZI', 'CEDUTO'];
  if (!statiValidi.includes(stato_interesse)) {
    return res.status(400).json({ error: 'Stato non valido' });
  }

  try {
    const result = await pool.query(
      'UPDATE censimenti_immobili SET stato_interesse = $1 WHERE id = $2 AND user_id = $3',
      [stato_interesse, id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore cambio stato:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento stato' });
  }
});

// ── PATCH /:id/preferito — aggiunge/rimuove dai preferiti ───────────────
router.patch('/:id/preferito', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  const { preferito } = req.body;
  try {
    const result = await pool.query(
      'UPDATE censimenti_immobili SET preferito = $1 WHERE id = $2 AND user_id = $3',
      [Boolean(preferito), id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore toggle preferito:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento preferito' });
  }
});

// ── DELETE /:id — elimina censimento (solo owner) ─────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const result = await pool.query(
      'DELETE FROM censimenti_immobili WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore eliminazione:', err.message);
    res.status(500).json({ error: "Errore durante l'eliminazione" });
  }
});

module.exports = router;
