/**
 * requireAdmin.js - Middleware ruolo admin
 *
 * Da usare DOPO requireAuth.
 * Blocca con 403 Forbidden chiunque non sia admin.
 *
 * Esempio uso in una route:
 *   router.get('/lista', requireAuth, requireAdmin, handler)
 */

module.exports = function requireAdmin(req, res, next) {
  if (req.user?.ruolo !== 'admin') {
    console.log(`[ADMIN] Accesso negato per ruolo '${req.user?.ruolo}' su ${req.path}`);
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  next();
};
