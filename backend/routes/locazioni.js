/**
 * Route /api/locazioni — Locazioni attive
 *
 * Gestione contratti di affitto per ogni utente.
 *
 *   GET    /         Lista locazioni dell'utente
 *   POST   /         Aggiunge nuova locazione
 *   PUT    /:id      Aggiorna locazione (solo owner)
 *   DELETE /:id      Elimina locazione (solo owner)
 */

const router      = require('express').Router();
const requireAuth = require('../middleware/auth');
const { pool }    = require('../config/db');

router.use(requireAuth);

// ── GET / — lista locazioni dell'utente autenticato ──────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM locazioni_attive WHERE user_id = ? ORDER BY data_inserimento DESC',
      [req.user.id]
    );
    console.log(`[LOCAZIONI] ${rows.length} locazioni per utente ${req.user.id}`);
    res.json(rows);
  } catch (err) {
    console.error('[LOCAZIONI] Errore lista:', err.message);
    res.status(500).json({ error: 'Errore nel recupero locazioni' });
  }
});

// ── POST / — aggiunge nuova locazione ────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    indirizzo, quartiere, tipologia, superficie_mq, canone_mensile,
    nome_inquilino, cognome_inquilino, email_inquilino, telefono_inquilino,
    data_inizio, data_fine, stato, note,
  } = req.body;

  if (!indirizzo) return res.status(400).json({ error: 'Indirizzo obbligatorio' });

  try {
    const [result] = await pool.query(
      `INSERT INTO locazioni_attive
        (user_id, indirizzo, quartiere, tipologia, superficie_mq, canone_mensile,
         nome_inquilino, cognome_inquilino, email_inquilino, telefono_inquilino,
         data_inizio, data_fine, stato, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        indirizzo,
        quartiere || null,
        tipologia || null,
        superficie_mq || null,
        canone_mensile || null,
        nome_inquilino || null,
        cognome_inquilino || null,
        email_inquilino || null,
        telefono_inquilino || null,
        data_inizio || null,
        data_fine || null,
        stato || 'ATTIVA',
        note || null,
      ]
    );
    console.log(`[LOCAZIONI] Nuova locazione ID ${result.insertId} per utente ${req.user.id}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[LOCAZIONI] Errore inserimento:', err.message);
    res.status(500).json({ error: 'Errore durante l\'inserimento' });
  }
});

// ── PUT /:id — aggiorna locazione (solo owner) ───────────────────────────
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const [rows] = await pool.query(
      'SELECT id FROM locazioni_attive WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Locazione non trovata' });

    const {
      indirizzo, quartiere, tipologia, superficie_mq, canone_mensile,
      nome_inquilino, cognome_inquilino, email_inquilino, telefono_inquilino,
      data_inizio, data_fine, stato, note,
    } = req.body;

    await pool.query(
      `UPDATE locazioni_attive
       SET indirizzo=?, quartiere=?, tipologia=?, superficie_mq=?, canone_mensile=?,
           nome_inquilino=?, cognome_inquilino=?, email_inquilino=?, telefono_inquilino=?,
           data_inizio=?, data_fine=?, stato=?, note=?
       WHERE id = ? AND user_id = ?`,
      [
        indirizzo, quartiere || null, tipologia || null,
        superficie_mq || null, canone_mensile || null,
        nome_inquilino || null, cognome_inquilino || null,
        email_inquilino || null, telefono_inquilino || null,
        data_inizio || null, data_fine || null,
        stato || 'ATTIVA', note || null,
        id, req.user.id,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[LOCAZIONI] Errore aggiornamento:', err.message);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// ── DELETE /:id — elimina locazione (solo owner) ─────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const [result] = await pool.query(
      'DELETE FROM locazioni_attive WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Locazione non trovata' });
    console.log(`[LOCAZIONI] Eliminata locazione ID ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[LOCAZIONI] Errore eliminazione:', err.message);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

module.exports = router;
