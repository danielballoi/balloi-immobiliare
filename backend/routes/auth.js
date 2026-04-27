/**
 * auth.js - Route di autenticazione
 *
 * POST /api/auth/register  → richiesta registrazione (stato 'pending')
 * POST /api/auth/login     → login con httpOnly cookies (access 15m + refresh 30d)
 * POST /api/auth/refresh   → rinnova access token via refresh cookie
 * POST /api/auth/logout    → cancella cookies e revoca refresh token
 * GET  /api/auth/me        → dati utente loggato
 *
 * Sicurezza:
 *   - Rate limiting 10 req/15 min per IP
 *   - Bcrypt cost 12 sulle password
 *   - Timing-attack prevention al login
 *   - Token JWT in httpOnly cookie (no XSS)
 *   - Refresh token ruotante (old revocato ad ogni rinnovo)
 *   - Refresh token hash SHA-256 nel DB (no plaintext)
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const User      = require('../models/User');
const { pool }  = require('../config/db');
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

// ── Cookie options base ────────────────────────────────────────────────────
const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

function isEmailValida(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isPasswordRobusta(pwd) {
  return pwd.length >= 8
    && /[A-Z]/.test(pwd)
    && /[0-9]/.test(pwd)
    && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
}

function generaAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, ruolo: user.ruolo },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

async function generaRefreshToken(userId) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, hash, expiresAt]
  );
  return rawToken;
}

function impostaCookies(res, accessToken, refreshToken) {
  res.cookie('balloi_token', accessToken, {
    ...cookieBase,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('balloi_refresh', refreshToken, {
    ...cookieBase,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function cancellaCookies(res) {
  res.clearCookie('balloi_token',   cookieBase);
  res.clearCookie('balloi_refresh', cookieBase);
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/auth/register
// Crea l'utente in stato 'pending'. Non emette token.
// ══════════════════════════════════════════════════════════════════════════
router.post('/register', authLimiter, async (req, res) => {
  const { username, nome, cognome, email, password } = req.body;

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
    const esistente = await User.findByEmail(email);
    if (esistente) {
      return res.status(409).json({ error: 'Registrazione non possibile con questi dati' });
    }
    const usernameEsistente = await User.findByUsername(username);
    if (usernameEsistente) {
      return res.status(409).json({ error: 'Username già in uso' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    await User.create({ username, email, password_hash, nome, cognome, ruolo: 'user', stato: 'pending' });

    console.log(`[AUTH] Nuova richiesta registrazione (pending): ${email}`);

    res.status(202).json({
      pending: true,
      message: "Richiesta inviata! Il tuo account deve essere approvato dall'amministratore. Riceverai accesso a breve."
    });
  } catch (err) {
    console.error('[AUTH] Errore registrazione:', err.message);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// Verifica credenziali, imposta httpOnly cookies, NON restituisce il token.
// ══════════════════════════════════════════════════════════════════════════
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  try {
    const utente = await User.findByEmail(email);

    const hashDaConfrontare = utente?.password_hash ?? '$2b$12$placeholder.hash.to.prevent.timing.attack';
    const passwordCorretta = await bcrypt.compare(password, hashDaConfrontare);

    if (!utente || !passwordCorretta) {
      console.log(`[AUTH] Login fallito (credenziali errate): ${email}`);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    if (utente.stato === 'pending') {
      console.log(`[AUTH] Login bloccato (pending): ${email}`);
      return res.status(403).json({ error: 'Account in attesa di approvazione', stato: 'pending' });
    }
    if (utente.stato === 'bloccato') {
      console.log(`[AUTH] Login bloccato (bloccato): ${email}`);
      return res.status(403).json({ error: "Account bloccato. Contatta l'amministratore.", stato: 'bloccato' });
    }

    await User.aggiornaUltimoAccesso(utente.id);

    const accessToken  = generaAccessToken(utente);
    const refreshToken = await generaRefreshToken(utente.id);
    impostaCookies(res, accessToken, refreshToken);

    console.log(`[AUTH] Login riuscito: ${email} (ruolo: ${utente.ruolo})`);

    res.json({
      user: {
        id:       utente.id,
        username: utente.username,
        email:    utente.email,
        nome:     utente.nome,
        cognome:  utente.cognome,
        ruolo:    utente.ruolo,
      }
    });
  } catch (err) {
    console.error('[AUTH] Errore login:', err.message);
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh
// Legge il cookie balloi_refresh, lo verifica nel DB, emette nuovo access token.
// Ruota anche il refresh token (vecchio revocato, nuovo emesso).
// ══════════════════════════════════════════════════════════════════════════
router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.balloi_refresh;
  if (!rawToken) {
    return res.status(401).json({ error: 'Refresh token mancante' });
  }

  try {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [righe] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [hash]
    );

    if (righe.length === 0) {
      cancellaCookies(res);
      return res.status(401).json({ error: 'Sessione scaduta. Effettua nuovamente il login.' });
    }

    const rt = righe[0];
    const utente = await User.findById(rt.user_id);

    if (!utente || utente.stato !== 'attivo') {
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
      cancellaCookies(res);
      return res.status(403).json({ error: 'Account non attivo' });
    }

    // Rotazione: elimina il vecchio, emette il nuovo
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
    const nuovoAccess  = generaAccessToken(utente);
    const nuovoRefresh = await generaRefreshToken(utente.id);
    impostaCookies(res, nuovoAccess, nuovoRefresh);

    console.log(`[AUTH] Token rinnovato per: ${utente.email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] Errore refresh:', err.message);
    res.status(500).json({ error: 'Errore durante il rinnovo sessione' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// Revoca il refresh token dal DB e cancella i cookie.
// ══════════════════════════════════════════════════════════════════════════
router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.balloi_refresh;
  if (rawToken) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]).catch(() => {});
  }
  cancellaCookies(res);
  console.log('[AUTH] Logout eseguito');
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/auth/me — dati utente corrente (richiede token)
// ══════════════════════════════════════════════════════════════════════════
router.get('/me', requireAuth, async (req, res) => {
  try {
    const utente = await User.findById(req.user.id);
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

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
