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
    const [rows] = await pool.query(
      'SELECT * FROM censimenti_immobili WHERE user_id = ? ORDER BY data_inserimento DESC',
      [req.user.id]
    );
    console.log(`[CENSIMENTI] ${rows.length} censimenti per utente ${req.user.id}`);
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
    return res.status(400).json({ error: 'Inserisci l\'indirizzo' });
  }

  try {
    const [result] = await pool.query(
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ascensore ? 1 : 0, box_auto ? 1 : 0, balcone_terrazza ? 1 : 0, giardino ? 1 : 0,
        prezzo_acquisto || null, spese_condominiali_mensili || null,
        rendita_catastale || null, imu_annua || null, tari_annua || null,
        prezzo_valutato_giusto || null, rendita_mensile_stimata || null,
        rendimento_annuo_stimato_pct || null,
        giudizio_personale || null, origine || 'MANUALE', url_annuncio || null,
      ]
    );
    console.log(`[CENSIMENTI] Nuovo censimento ID ${result.insertId} per utente ${req.user.id}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[CENSIMENTI] Errore inserimento:', err.message);
    res.status(500).json({ error: 'Errore durante l\'inserimento' });
  }
});

// ── PUT /:id — aggiorna censimento (solo owner) ───────────────────────────
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const [rows] = await pool.query(
      'SELECT id FROM censimenti_immobili WHERE id = ? AND user_id = ?',
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
       SET indirizzo=?, quartiere=?, citta=?, cap=?, tipologia=?,
           superficie_mq=?, prezzo_richiesto=?, stato_interesse=?,
           stato_immobile=?, venditore=?, note=?,
           tipo_acquisizione=?, link_riferimento=?, data_inizio_asta=?,
           classe_energetica=?, esposizione=?, vista=?,
           qualita_costruzione=?, luminosita=?, stato_conservazione=?, fascia_omi=?,
           piano=?, num_locali=?, num_bagni=?, anno_costruzione=?,
           ascensore=?, box_auto=?, balcone_terrazza=?, giardino=?,
           prezzo_acquisto=?, spese_condominiali_mensili=?, rendita_catastale=?,
           imu_annua=?, tari_annua=?,
           prezzo_valutato_giusto=?, rendita_mensile_stimata=?,
           rendimento_annuo_stimato_pct=?, giudizio_personale=?,
           url_annuncio=?,
           origine=COALESCE(?, origine)
       WHERE id = ? AND user_id = ?`,
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
        ascensore ? 1 : 0, box_auto ? 1 : 0, balcone_terrazza ? 1 : 0, giardino ? 1 : 0,
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
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// ── PATCH /:id/note — aggiorna solo il campo note (salvataggio rapido) ──
router.patch('/:id/note', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
  const { note } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE censimenti_immobili SET note = ? WHERE id = ? AND user_id = ?',
      [note ?? null, id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    console.log(`[CENSIMENTI] Note aggiornate per ID ${id}`);
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
    const [result] = await pool.query(
      'UPDATE censimenti_immobili SET stato_interesse = ? WHERE id = ? AND user_id = ?',
      [stato_interesse, id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    console.log(`[CENSIMENTI] Stato aggiornato a ${stato_interesse} per ID ${id}`);
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
    const [result] = await pool.query(
      'UPDATE censimenti_immobili SET preferito = ? WHERE id = ? AND user_id = ?',
      [preferito ? 1 : 0, id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    console.log(`[CENSIMENTI] Preferito ${preferito ? 'aggiunto' : 'rimosso'} per ID ${id}`);
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
    const [result] = await pool.query(
      'DELETE FROM censimenti_immobili WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Censimento non trovato' });
    console.log(`[CENSIMENTI] Eliminato censimento ID ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore eliminazione:', err.message);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

module.exports = router;
