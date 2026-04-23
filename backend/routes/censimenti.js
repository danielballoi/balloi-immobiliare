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
    titolo, indirizzo, quartiere, tipologia,
    superficie_mq, prezzo_richiesto, stato_interesse,
    stato_immobile, venditore, note,
  } = req.body;

  if (!indirizzo && !titolo) {
    return res.status(400).json({ error: 'Inserisci almeno titolo o indirizzo' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO censimenti_immobili
        (user_id, titolo, indirizzo, quartiere, tipologia, superficie_mq,
         prezzo_richiesto, stato_interesse, stato_immobile, venditore, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        titolo || null,
        indirizzo || null,
        quartiere || null,
        tipologia || null,
        superficie_mq || null,
        prezzo_richiesto || null,
        stato_interesse || 'INTERESSATO',
        stato_immobile || null,
        venditore || null,
        note || null,
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
    // Verifica che l'immobile appartenga all'utente
    const [rows] = await pool.query(
      'SELECT id FROM censimenti_immobili WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Censimento non trovato' });

    const {
      titolo, indirizzo, quartiere, tipologia,
      superficie_mq, prezzo_richiesto, stato_interesse,
      stato_immobile, venditore, note,
    } = req.body;

    await pool.query(
      `UPDATE censimenti_immobili
       SET titolo=?, indirizzo=?, quartiere=?, tipologia=?,
           superficie_mq=?, prezzo_richiesto=?, stato_interesse=?,
           stato_immobile=?, venditore=?, note=?
       WHERE id = ? AND user_id = ?`,
      [
        titolo, indirizzo, quartiere, tipologia,
        superficie_mq || null, prezzo_richiesto || null,
        stato_interesse || 'INTERESSATO', stato_immobile || null,
        venditore || null, note || null,
        id, req.user.id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[CENSIMENTI] Errore aggiornamento:', err.message);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
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
