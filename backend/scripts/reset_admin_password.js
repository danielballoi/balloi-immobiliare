// Uso (PowerShell, dalla cartella backend):
//   $env:ADMIN_EMAIL="tua@email.it"; $env:NEW_PASSWORD="una-password-lunga-e-unica"; node scripts/reset_admin_password.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

(async () => {
  const email = process.env.ADMIN_EMAIL;
  const pwd   = process.env.NEW_PASSWORD;
  if (!email || !pwd || pwd.length < 12) {
    console.error('Servono ADMIN_EMAIL e NEW_PASSWORD (minimo 12 caratteri).');
    process.exit(1);
  }
  const hash = await bcrypt.hash(pwd, 12);
  const [r] = await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);
  console.log(r.affectedRows ? '[OK] Password aggiornata.' : '[!] Nessun utente con questa email.');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
