# MIGRATION REPORT — MySQL → PostgreSQL

## Sommario

| Categoria | Dettagli |
|-----------|---------|
| **Data** | 2026-05-18 |
| **Branch** | feature/postgres-migration |
| **DB sorgente** | MySQL 8.0 (database: omi) |
| **DB destinazione** | PostgreSQL 16 |
| **File modificati** | 10 (db.js + 7 models + 2 route files con query dirette) |

---

## File con dipendenze MySQL rilevate

### Import mysql2
- `backend/config/db.js` — `require('mysql2/promise')`
- **Tutti i models e route usano `pool` esportato da db.js**

### Pattern MySQL-specifici trovati e convertiti

| Pattern MySQL | Occorrenze | File |
|---------------|-----------|------|
| `INT AUTO_INCREMENT PRIMARY KEY` | 11 tabelle | db.js |
| `TINYINT(1)` | ~15 colonne | db.js |
| `DATETIME` | 2 colonne | db.js |
| `ENGINE=InnoDB` | assente (non usato) | — |
| `ENUM(...)` | 5 colonne | db.js |
| `UNIQUE KEY nome (col)` | 3 | db.js |
| `INDEX idx_x (col)` | 6 | db.js |
| `const [rows] = await` | ~40 | models/, routes/ |
| `result.insertId` | 8 | models/, routes/ |
| `result.affectedRows` | 12 | models/, routes/ |
| `ON DUPLICATE KEY UPDATE` | 7 | models/Import.js |
| `INSERT IGNORE` | 2 | models/Import.js |
| `FIELD(col, ...)` | 1 | models/User.js |
| `? placeholder` | ~100 | tutti i file |
| `[[{ count }]] destructure` | 5 | models/ |

---

## Conversioni effettuate

### Schema (db.js)
- `INT AUTO_INCREMENT PRIMARY KEY` → `SERIAL PRIMARY KEY`
- `TINYINT(1)` → `BOOLEAN`
- `DATETIME` → `TIMESTAMP`
- `ENUM(...)` → `VARCHAR(30)` con vincolo CHECK (compatibilità Neon)
- `UNIQUE KEY nome (col)` → `UNIQUE(col)` inline
- `INDEX idx_x (col)` → `CREATE INDEX IF NOT EXISTS` separato
- `ON UPDATE CURRENT_TIMESTAMP` → rimosso
- `INSERT IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- `ON DUPLICATE KEY UPDATE` → `INSERT ... ON CONFLICT (...) DO UPDATE SET`

### Query
- Tutti i `?` → `$1, $2, $3...` numerati
- `const [rows] = await pool.query(...)` → `const { rows } = await pool.query(...)`
- `const [[row]] = await pool.query(...)` → `const { rows } = await; const row = rows[0]`
- `result.insertId` → `... RETURNING id` + `rows[0].id`
- `result.affectedRows` → `result.rowCount`
- `FIELD(stato, 'a','b','c')` → `CASE WHEN ... END` in User.js
- `1 : 0` boolean params → `true : false`

### Transazioni
- `pool.getConnection()` + `conn.beginTransaction()` → `pool.connect()` + `client.query('BEGIN')`
- `conn.release()` → `client.release()`

---

## Tabelle create

1. `valutazioni` — valutazioni immobiliari
2. `portafoglio` — portfolio immobiliare utenti
3. `import_log` — log importazioni CSV
4. `omi_ntn` — Numero Transazioni Normalizzate
5. `strade_cagliari` — strade di Cagliari con quartieri
6. `users` — utenti con ruolo/stato
7. `censimenti_immobili` — censimento immobili personali
8. `locazioni_attive` — contratti di locazione
9. `segnalazioni` — messaggi utenti → admin
10. `refresh_tokens` — token di rinnovo JWT
11. `omi_zone` — zone OMI (creata altrove, usata da Join)
12. `omi_valori` — prezzi OMI (creata altrove, usata da Join)
