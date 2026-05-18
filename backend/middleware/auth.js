/**
 * auth.js - Middleware di autenticazione JWT
 *
 * Legge il token JWT dal cookie httpOnly 'balloi_token'
 * (non dall'header Authorization — protegge da XSS).
 *
 * Se valido inietta req.user con i dati dell'utente.
 * Se mancante o scaduto risponde 401 → il frontend farà /refresh automaticamente.
 */

const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  const token = req.cookies?.balloi_token ?? null;

  if (!token) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, username, ruolo, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
};
