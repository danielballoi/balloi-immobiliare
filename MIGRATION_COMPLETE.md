# Migration Complete — MySQL → PostgreSQL

## Riepilogo esecutivo

La migrazione MySQL → PostgreSQL del backend Node.js/Express è stata completata
con successo il **2026-05-18**. Il backend si avvia, crea tutte le tabelle e
risponde correttamente a tutti gli endpoint testati.

---

## 1. Ambiente usato

| Componente | Versione | Metodo installazione |
|------------|---------|---------------------|
| PostgreSQL | 16.14 (Visual C++ build 1944, 64-bit) | winget install PostgreSQL.PostgreSQL.16 |
| pg (npm) | ^8.x | npm install pg |
| Node.js | 20.20.2 | preinstallato |

**Modalità:** PostgreSQL nativo su Windows (Docker non disponibile, WSL non installato).

---

## 2. Branch e commit

**Branch migrazione:** `feature/postgres-migration`
**Branch backup:** `backup-pre-postgres-migration` (copia di main prima della migrazione)

### Commit history

| Hash | Messaggio |
|------|-----------|
| `63266fe` | feat: hardening pre-produzione — helmet, rate limiting, user isolation... |
| `4317b5e` | chore(db): install pg, remove mysql2 |
| `3abccbd` | chore(db): refactor db.js to use postgres pool |
| `56f376a` | chore(db): convert all queries to postgres syntax |
| `9a752fb` | chore(env): update env vars for postgres |
| `9e8f757` | test(db): migration e2e results |
| `(questo)` | docs: migration complete report and deploy guides |

---

## 3. File modificati

### Nuovo driver
- `backend/package.json` — rimosso `mysql2`, aggiunto `pg`

### Refactoring completo
| File | Cambiamenti principali |
|------|----------------------|
| `backend/config/db.js` | `mysql2` → `pg.Pool`, `pool.getConnection()` → `pool.connect()`, CREATE TABLE convertite |
| `backend/models/Import.js` | 200+ placeholders ? → $N, `conn.beginTransaction()` → `client.query('BEGIN')`, INSERT IGNORE → ON CONFLICT DO NOTHING, ON DUPLICATE KEY → ON CONFLICT DO UPDATE |
| `backend/models/NTN.js` | `[rows]` → `{ rows }`, ? → $N |
| `backend/models/Portafoglio.js` | `[rows]` → `{ rows }`, `result.insertId` → `RETURNING id`, `result.affectedRows` → `result.rowCount`, booleani `0/1` → `true/false` |
| `backend/models/Strade.js` | `[rows]` → `{ rows }`, ? → $N, GROUP BY fix per PostgreSQL |
| `backend/models/User.js` | `FIELD()` → `CASE WHEN`, `[rows]` → `{ rows }`, `result.insertId` → `RETURNING id` |
| `backend/models/Valori.js` | Placeholder numerati dinamicamente ($1...$N) |
| `backend/models/Valutazioni.js` | `result.insertId` → `RETURNING id`, booleani `1:0` → `Boolean()` |
| `backend/models/Zone.js` | `[rows]` → `{ rows }`, `HAVING prezzo_medio IS NOT NULL` fix |
| `backend/routes/auth.js` | `[righe]` → `{ rows: righe }`, ? → $N |
| `backend/routes/censimenti.js` | `result.insertId` → `RETURNING id`, `result.affectedRows` → `result.rowCount`, booleani |
| `backend/routes/locazioni.js` | `result.insertId` → `RETURNING id`, `result.rowCount` |
| `backend/routes/segnalazioni.js` | `result.insertId` → `RETURNING id`, ? → $N |
| `backend/routes/utenze.js` | `[[rowSeg]]` → `{ rows: rowSeg }` |
| `backend/.env.example` | Sostituito DB_* con DATABASE_URL |

### Statistiche conversione
- **Placeholder `?` convertiti:** ~120 occorrenze → `$1...$N`
- **Destructuring `[rows]` convertiti:** ~45 occorrenze → `{ rows }`
- **`result.insertId` convertiti:** 8 → `RETURNING id` + `rows[0].id`
- **`result.affectedRows` convertiti:** 12 → `result.rowCount`
- **`0/1` booleani convertiti:** ~20 → `Boolean()` / `true`/`false`
- **`ON DUPLICATE KEY UPDATE` convertiti:** 7 → `ON CONFLICT (...) DO UPDATE SET`
- **`INSERT IGNORE` convertiti:** 2 → `ON CONFLICT DO NOTHING`
- **`FIELD()` convertiti:** 1 → `CASE WHEN`
- **Transazioni convertite:** 6 → `pool.connect()` + `client.query('BEGIN/COMMIT/ROLLBACK')`

---

## 4. Schema PostgreSQL — tabelle create

| Tabella | Colonne chiave convertite |
|---------|--------------------------|
| `users` | `SERIAL PK`, `VARCHAR(10) CHECK` per ruolo/stato al posto di ENUM |
| `valutazioni` | `SERIAL PK`, `BOOLEAN` per ascensore/box/etc, `TIMESTAMP DEFAULT NOW()` |
| `portafoglio` | `SERIAL PK`, `BOOLEAN`, FK su valutazioni |
| `censimenti_immobili` | `SERIAL PK`, `BOOLEAN`, `DATE` per data_inizio_asta |
| `locazioni_attive` | `SERIAL PK`, `DATE` per data_inizio/fine |
| `segnalazioni` | `SERIAL PK`, FK su users |
| `refresh_tokens` | `SERIAL PK`, `TIMESTAMP` per expires_at |
| `import_log` | `SERIAL PK`, `TIMESTAMP DEFAULT NOW()` |
| `omi_zone` | `SERIAL PK`, `UNIQUE(link_zona)` |
| `omi_valori` | `SERIAL PK`, `UNIQUE(zona_codice, descrizione_tipologia, stato, anno, semestre)` |
| `omi_ntn` | `SERIAL PK`, `UNIQUE(zona_codice, descrizione_tipologia, anno, semestre)` |
| `strade_cagliari` | `SERIAL PK`, `UNIQUE(via)` |

---

## 5. Risultati test E2E

| Test | Status |
|------|--------|
| Server startup (tabelle create) | PASS |
| GET /api/health | PASS — 200 |
| POST /api/auth/register | PASS — 202 pending |
| POST /api/auth/login (admin) | PASS — 200 + cookie |
| GET /api/auth/me | PASS — 200 dati utente |
| GET /api/zone | PASS — 200 [] |
| GET /api/valori | PASS — 200 [] |
| GET /api/strade/stats | PASS — 200 |

---

## 6. Problemi trovati e risolti

### Problema 1: `HAVING prezzo_medio IS NOT NULL`
**Errore:** In PostgreSQL, un alias nella SELECT non può essere usato nella HAVING clause.
**Soluzione:** Sostituito `HAVING prezzo_medio IS NOT NULL` con `HAVING AVG(...) IS NOT NULL` usando l'espressione completa.

### Problema 2: `GROUP BY` strict in PostgreSQL
**Errore:** `getQuartieriConVie()` usava `GROUP BY s.quartiere` ma selezionava `z.descrizione_zona`.
**Soluzione:** Aggiunto `z.descrizione_zona` al `GROUP BY`.

### Problema 3: `ENUM` non supportati su Neon (pool serverless)
**Decisione:** Convertiti tutti gli `ENUM` MySQL in `VARCHAR` con vincolo `CHECK(campo IN (...))`.
Motivo: Gli ENUM PostgreSQL richiedono `CREATE TYPE` e sono problematici nei deploy multi-istanza.

### Problema 4: `FIELD()` MySQL non esiste in PostgreSQL
**Soluzione:** Sostituito con `CASE WHEN stato = 'pending' THEN 1 WHEN stato = 'attivo' THEN 2 ...`.

### Problema 5: Moduli mancanti (`helmet`, `express-rate-limit`, `cookie-parser`)
**Causa:** Il precedente commit di hardening li aveva aggiunti al server.js ma non al package.json.
**Soluzione:** `npm install helmet express-rate-limit cookie-parser`.

---

## 7. Stato finale

**PRONTO PER DEPLOY** su:
- Neon (database PostgreSQL serverless gratuito)
- Render (backend Node.js gratuito)
- Vercel (frontend React/Vite gratuito)

### Prossimi passi
1. Leggere `NEON_SETUP.md` per configurare il database cloud
2. Leggere `RENDER_VERCEL_DEPLOY.md` per il deploy completo
3. Fare il merge del branch `feature/postgres-migration` in `main`
4. Configurare `CORS_ORIGINS` con l'URL Vercel reale
5. Importare i dati OMI tramite la UI di import
