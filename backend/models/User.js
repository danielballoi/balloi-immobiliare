/**
 * User.js - Modello utente
 *
 * Contiene tutte le query SQL per la tabella `users`.
 * Query parametrizzate → protezione nativa da SQL injection.
 *
 * Colonne chiave:
 *   stato: 'pending' | 'attivo' | 'bloccato'
 *   ruolo: 'admin' | 'user'
 */

const { pool } = require('../config/db');

const User = {
  /** Trova per email — include password_hash per il confronto al login */
  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  },

  /** Trova per username */
  async findByUsername(username) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );
    return rows[0] || null;
  },

  /**
   * Crea un nuovo utente in stato 'pending'.
   * La password deve essere già hashata con bcrypt.
   */
  async create({ username, email, password_hash, nome, cognome, ruolo = 'user', stato = 'pending' }) {
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, nome, cognome, ruolo, stato) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username.trim(), email.toLowerCase().trim(), password_hash, nome?.trim() || null, cognome?.trim() || null, ruolo, stato]
    );
    return { id: result.insertId, username, email, nome, cognome, ruolo, stato };
  },

  /** Dati utente senza password_hash — sicuro da inviare al client */
  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, username, email, nome, cognome, ruolo, stato, ultimo_accesso, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Lista tutti gli utenti (admin only).
   * Ordina: prima i pending, poi attivi, poi bloccati, per data decrescente.
   */
  async findAll() {
    const [rows] = await pool.query(`
      SELECT id, username, email, nome, cognome, ruolo, stato, ultimo_accesso, created_at
      FROM users
      ORDER BY
        FIELD(stato, 'pending', 'attivo', 'bloccato'),
        created_at DESC
    `);
    return rows;
  },

  /** Cambia stato di un utente: 'pending' | 'attivo' | 'bloccato' */
  async aggiornaStato(id, stato) {
    await pool.query('UPDATE users SET stato = ? WHERE id = ?', [stato, id]);
  },

  /** Elimina utente — solo admin, non può eliminare se stesso */
  async elimina(id) {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  },

  /** Aggiorna timestamp ultimo accesso */
  async aggiornaUltimoAccesso(id) {
    await pool.query('UPDATE users SET ultimo_accesso = NOW() WHERE id = ?', [id]);
  },
};

module.exports = User;
