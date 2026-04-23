/**
 * utenze.js - Gestione utenti (solo admin)
 *
 * Tutti gli endpoint richiedono:
 *   1. Token JWT valido (requireAuth)
 *   2. Ruolo admin (requireAdmin)
 *
 * Endpoints:
 *   GET    /api/utenze          → lista tutti gli utenti
 *   PUT    /api/utenze/:id/approva  → attiva utente pending
 *   PUT    /api/utenze/:id/blocca   → blocca utente attivo
 *   PUT    /api/utenze/:id/riattiva → riattiva utente bloccato
 *   DELETE /api/utenze/:id          → elimina utente (non se stesso)
 */

const express      = require('express');
const requireAuth  = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const User         = require('../models/User');
const { pool }     = require('../config/db');

const router = express.Router();

// Tutti gli endpoint qui sotto richiedono auth + admin
router.use(requireAuth, requireAdmin);

// ══════════════════════════════════════════════════════════════════════════
// GET /api/utenze — lista completa utenti
// ══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const utenti = await User.findAll();
    // Conta per stato — utile per i badge nel frontend
    const conteggi = { pending: 0, attivo: 0, bloccato: 0, totale: utenti.length };
    utenti.forEach(u => { if (conteggi[u.stato] !== undefined) conteggi[u.stato]++; });

    // Conta segnalazioni nuove — per il badge "nuovo messaggio"
    const [[rowSeg]] = await pool.query(
      "SELECT COUNT(*) as nuove FROM segnalazioni WHERE stato = 'NUOVO'"
    );
    conteggi.messaggi_nuovi = rowSeg.nuove;

    console.log(`[UTENZE] Lista richiesta da admin ${req.user.email}: ${utenti.length} utenti, ${rowSeg.nuove} messaggi nuovi`);
    res.json({ utenti, conteggi });
  } catch (err) {
    console.error('[UTENZE] Errore lista:', err.message);
    res.status(500).json({ error: 'Errore nel recupero utenti' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/utenze/:id/approva — pending → attivo
// ══════════════════════════════════════════════════════════════════════════
router.put('/:id/approva', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const utente = await User.findById(id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });
    if (utente.ruolo === 'admin') return res.status(400).json({ error: "Non puoi modificare l'account admin" });
    if (utente.stato === 'attivo') return res.status(400).json({ error: 'Utente già attivo' });

    await User.aggiornaStato(id, 'attivo');
    console.log(`[UTENZE] Utente ${utente.email} approvato da ${req.user.email}`);
    res.json({ message: `Account di ${utente.email} attivato con successo` });
  } catch (err) {
    console.error('[UTENZE] Errore approva:', err.message);
    res.status(500).json({ error: 'Errore durante l\'approvazione' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/utenze/:id/blocca — attivo → bloccato
// ══════════════════════════════════════════════════════════════════════════
router.put('/:id/blocca', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
  if (id === req.user.id) return res.status(400).json({ error: 'Non puoi bloccare te stesso' });

  try {
    const utente = await User.findById(id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });
    if (utente.ruolo === 'admin') return res.status(400).json({ error: "Non puoi bloccare l'account admin" });
    if (utente.stato === 'bloccato') return res.status(400).json({ error: 'Utente già bloccato' });

    await User.aggiornaStato(id, 'bloccato');
    console.log(`[UTENZE] Utente ${utente.email} bloccato da ${req.user.email}`);
    res.json({ message: `Account di ${utente.email} bloccato` });
  } catch (err) {
    console.error('[UTENZE] Errore blocca:', err.message);
    res.status(500).json({ error: 'Errore durante il blocco' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/utenze/:id/riattiva — bloccato/pending → attivo
// ══════════════════════════════════════════════════════════════════════════
router.put('/:id/riattiva', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });

  try {
    const utente = await User.findById(id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });
    if (utente.stato === 'attivo') return res.status(400).json({ error: 'Utente già attivo' });

    await User.aggiornaStato(id, 'attivo');
    console.log(`[UTENZE] Utente ${utente.email} riattivato da ${req.user.email}`);
    res.json({ message: `Account di ${utente.email} riattivato` });
  } catch (err) {
    console.error('[UTENZE] Errore riattiva:', err.message);
    res.status(500).json({ error: 'Errore durante la riattivazione' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/utenze/:id — elimina utente
// ══════════════════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
  if (id === req.user.id) return res.status(400).json({ error: 'Non puoi eliminare te stesso' });

  try {
    const utente = await User.findById(id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });
    if (utente.ruolo === 'admin') return res.status(400).json({ error: "Non puoi eliminare l'account admin" });

    await User.elimina(id);
    console.log(`[UTENZE] Utente ${utente.email} eliminato da ${req.user.email}`);
    res.json({ message: `Account di ${utente.email} eliminato` });
  } catch (err) {
    console.error('[UTENZE] Errore elimina:', err.message);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

module.exports = router;
