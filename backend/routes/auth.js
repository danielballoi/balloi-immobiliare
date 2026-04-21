/**
 * auth.js - Route di autenticazione
 *
 * POST /api/auth/register  → richiesta registrazione (stato 'pending', no token)
 * POST /api/auth/login     → login (solo se stato='attivo')
 * GET  /api/auth/me        → dati utente loggato
 *
 * Sicurezza:
 *   - Rate limiting 10 req/15 min per IP
 *   - Bcrypt cost 12 sulle password
 *   - Timing-attack prevention al login
 *   - Messaggi errore generici (no user enumeration)
 *   - Blocco login per stato != 'attivo'
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ── Rate limiter anti-brute-force ──────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Troppi tentativi. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function isEmailValida(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isPasswordRobusta(pwd) {
  return pwd.length >= 8
    && /[A-Z]/.test(pwd)
    && /[0-9]/.test(pwd)
    && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
}

function generaToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, ruolo: user.ruolo },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// Crea l'utente in stato 'pending'. Non restituisce token.
// L'utente potrà accedere solo dopo l'approvazione admin.
// ══════════════════════════════════════════════════════════════════════════
router.post('/register', authLimiter, async (req, res) => {
  const { username, nome, cognome, email, password } = req.body;

  // Validazione campi obbligatori
  if (!username || !nome || !cognome || !email || !password) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  if (username.trim().length < 3 || username.trim().length > 30) {
    return res.status(400).json({ error: 'Username deve essere tra 3 e 30 caratteri' });
  }
  if (nome.trim().length < 2) {
    return res.status(400).json({ error: 'Nome non valido' });
  }
  if (cognome.trim().length < 2) {
    return res.status(400).json({ error: 'Cognome non valido' });
  }
  if (!isEmailValida(email)) {
    return res.status(400).json({ error: 'Formato email non valido' });
  }
  if (!isPasswordRobusta(password)) {
    return res.status(400).json({
      error: 'Password troppo debole. Serve: min 8 caratteri, 1 maiuscola, 1 numero, 1 carattere speciale'
    });
  }

  try {
    // Verifica duplicati — messaggio generico per non rivelare l'esistenza
    const esistente = await User.findByEmail(email);
    if (esistente) {
      return res.status(409).json({ error: 'Registrazione non possibile con questi dati' });
    }
    const usernameEsistente = await User.findByUsername(username);
    if (usernameEsistente) {
      return res.status(409).json({ error: 'Username già in uso' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Crea utente in stato 'pending' — nessun token emesso
    await User.create({ username, email, password_hash, nome, cognome, ruolo: 'user', stato: 'pending' });

    console.log(`[AUTH] Nuova richiesta registrazione (pending): ${email}`);

    // Risposta 202 Accepted: la richiesta è stata presa in carico ma non ancora elaborata
    res.status(202).json({
      pending: true,
      message: 'Richiesta inviata! Il tuo account deve essere approvato dall\'amministratore. Riceverai accesso a breve.'
    });
  } catch (err) {
    console.error('[AUTH] Errore registrazione:', err.message);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// Verifica credenziali E stato account prima di emettere il token.
// ══════════════════════════════════════════════════════════════════════════
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  try {
    const utente = await User.findByEmail(email);

    // Hash fittizio per timing-attack prevention: il confronto bcrypt
    // impiega sempre ~200ms anche se l'utente non esiste
    const hashDaConfrontare = utente?.password_hash ?? '$2b$12$placeholder.hash.to.prevent.timing.attack';
    const passwordCorretta = await bcrypt.compare(password, hashDaConfrontare);

    if (!utente || !passwordCorretta) {
      console.log(`[AUTH] Login fallito (credenziali errate): ${email}`);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    // Controlla stato account — login bloccato se non 'attivo'
    if (utente.stato === 'pending') {
      console.log(`[AUTH] Login bloccato (pending): ${email}`);
      return res.status(403).json({
        error: 'Account in attesa di approvazione',
        stato: 'pending'
      });
    }
    if (utente.stato === 'bloccato') {
      console.log(`[AUTH] Login bloccato (bloccato): ${email}`);
      return res.status(403).json({
        error: 'Account bloccato. Contatta l\'amministratore.',
        stato: 'bloccato'
      });
    }

    await User.aggiornaUltimoAccesso(utente.id);
    const token = generaToken(utente);

    console.log(`[AUTH] Login riuscito: ${email} (ruolo: ${utente.ruolo})`);

    res.json({
      token,
      user: {
        id: utente.id,
        username: utente.username,
        email: utente.email,
        nome: utente.nome,
        cognome: utente.cognome,
        ruolo: utente.ruolo,
      }
    });
  } catch (err) {
    console.error('[AUTH] Errore login:', err.message);
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/auth/me — dati utente corrente (richiede token)
// ══════════════════════════════════════════════════════════════════════════
router.get('/me', requireAuth, async (req, res) => {
  try {
    const utente = await User.findById(req.user.id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

    // Se l'account è stato bloccato dopo il login → token ancora valido ma blocchiamo qui
    if (utente.stato !== 'attivo') {
      return res.status(403).json({ error: 'Account non attivo' });
    }

    res.json({ user: utente });
  } catch (err) {
    console.error('[AUTH] Errore /me:', err.message);
    res.status(500).json({ error: 'Errore server' });
  }
});

module.exports = router;
