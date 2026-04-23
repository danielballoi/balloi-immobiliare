/**
 * Route /api/segnalazioni — Segnalazioni utenti → admin
 *
 * Gli utenti inviano segnalazioni/bug report all'admin.
 * L'admin le vede nella sezione Utenze con badge "nuovo messaggio".
 * L'admin non può rispondere: la risposta avviene via email.
 *
 *   POST   /             Invia segnalazione (utente autenticato)
 *   GET    /             Lista segnalazioni (solo admin)
 *   PUT    /:id/letto    Segna come letto (solo admin)
 *   GET    /count        Conta segnalazioni NUOVO (solo admin, usato per badge)
 */

const router       = require('express').Router();
const requireAuth  = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { pool }     = require('../config/db');

// ── POST / — invia segnalazione (tutti gli utenti autenticati) ────────────
router.post('/', requireAuth, async (req, res) => {
  const { oggetto, messaggio } = req.body;
  if (!messaggio || !messaggio.trim()) {
    return res.status(400).json({ error: 'Il messaggio non può essere vuoto' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO segnalazioni (user_id, oggetto, messaggio) VALUES (?, ?, ?)',
      [req.user.id, oggetto || 'Segnalazione', messaggio.trim()]
    );
    console.log(`[SEGNALAZIONI] Nuova segnalazione ID ${result.insertId} da utente ${req.user.id}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('[SEGNALAZIONI] Errore invio:', err.message);
    res.status(500).json({ error: 'Errore durante l\'invio' });
  }
});

// ── GET /count — conta segnalazioni NUOVO (admin only, per badge sidebar) ──
router.get('/count', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT COUNT(*) as nuove FROM segnalazioni WHERE stato = 'NUOVO'"
    );
    res.json({ nuove: row.nuove });
  } catch (err) {
    console.error('[SEGNALAZIONI] Errore count:', err.message);
    res.status(500).json({ error: 'Errore nel conteggio' });
  }
});

// ── GET / — lista completa segnalazioni (solo admin) ─────────────────────
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.nome, u.cognome, u.email, u.username
      FROM segnalazioni s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.data_invio DESC
    `);
    console.log(`[SEGNALAZIONI] Lista richiesta da admin: ${rows.length} segnalazioni`);
    res.json(rows);
  } catch (err) {
    console.error('[SEGNALAZIONI] Errore lista:', err.message);
    res.status(500).json({ error: 'Errore nel recupero segnalazioni' });
  }
});

// ── PUT /:id/letto — segna come letto (solo admin) ────────────────────────
router.put('/:id/letto', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    await pool.query("UPDATE segnalazioni SET stato = 'LETTO' WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[SEGNALAZIONI] Errore aggiornamento stato:', err.message);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

module.exports = router;
