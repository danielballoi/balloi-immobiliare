/**
 * auth.js - Middleware di autenticazione JWT
 *
 * Questo middleware verifica il token JWT in ogni richiesta protetta.
 * Funziona così:
 *   1. Legge l'header "Authorization: Bearer <token>"
 *   2. Verifica la firma del token con la chiave segreta
 *   3. Se valido, inietta req.user con i dati dell'utente
 *   4. Se non valido/mancante, risponde 401 Unauthorized
 *
 * Sicurezza:
 *   - Il token è firmato con HMAC-SHA256 (default jsonwebtoken)
 *   - La chiave segreta è in .env e non nel codice
 *   - Il token scade dopo JWT_EXPIRES_IN (7 giorni)
 */

const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  // Legge il token dall'header Authorization
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    console.log('[AUTH] Richiesta senza token su:', req.path);
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  try {
    // jwt.verify lancia eccezione se il token è scaduto o manomesso
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, username, ruolo, iat, exp }
    next();
  } catch (err) {
    console.log('[AUTH] Token non valido:', err.message);
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
};
