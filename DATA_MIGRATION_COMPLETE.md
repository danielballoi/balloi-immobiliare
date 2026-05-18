# DATA MIGRATION COMPLETE

**Data:** 2026-05-18
**Direzione:** MySQL "omi" → PostgreSQL "balloi"
**Risultato:** SUCCESSO — 0 errori, 100% dati migrati

---

## MySQL trovato

- **Percorso:** `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe`
- **Versione:** MySQL Server 8.4
- **Database sorgente:** `omi`
- **Utente:** `root` (senza password)

---

## Righe migrate per tabella

| Tabella              | MySQL | PostgreSQL | Stato |
|----------------------|------:|----------:|-------|
| users                |     7 |         7 | OK    |
| valutazioni          |    31 |        31 | OK    |
| portafoglio          |     2 |         2 | OK    |
| omi_zone             |   349 |       349 | OK    |
| omi_valori           | 15111 |     15111 | OK    |
| strade_cagliari      |  1393 |      1393 | OK    |
| segnalazioni         |     1 |         1 | OK    |
| import_log           |     3 |         3 | OK    |
| censimenti_immobili  |     0 |         0 | OK    |
| locazioni_attive     |     0 |         0 | OK    |
| omi_ntn              |     0 |         0 | OK    |
| refresh_tokens       |     0 |         0 | OK    |
| **TOTALE**           | **16.897** | **16.897** | **0% errori** |

---

## Pattern di conversione applicati

1. **Backtick identifiers** — `` `tabella` `` → `tabella` (rimozione backtick MySQL)
2. **Escape stringhe** — `\'` → `''` (standard SQL PostgreSQL)
3. **NULL MySQL** — `\N` → `NULL`
4. **Date zero** — `'0000-00-00 00:00:00'` / `'0000-00-00'` → `NULL`
5. **Boolean columns** — `0`/`1` → `false`/`true` per le colonne:
   - `valutazioni`: ascensore, box_auto, balcone_terrazza, cantina, salvato_portafoglio, has_abusi
   - `censimenti_immobili`: preferito, has_abusi, ascensore, box_auto, balcone_terrazza, giardino
6. **ON CONFLICT DO NOTHING** — su tutte le tabelle (per idempotenza)
7. **FK bypass** — `SET session_replication_role = 'replica'` durante import
8. **Sequence reset** — `setval()` su tutte le sequenze dopo import

---

## Errori incontrati e risolti

### Errore 1: `users_pkey` — chiave duplicata
- **Causa:** Prima esecuzione parziale aveva già inserito user id=1
- **Soluzione:** Aggiunto `ON CONFLICT DO NOTHING` su tutte le tabelle. Tabelle svuotate con `TRUNCATE ... RESTART IDENTITY CASCADE` e reimportate.

### Errore 2: Colonna `has_abusi` non esiste in `valutazioni`
- **Causa:** Lo schema PostgreSQL non aveva `has_abusi` e `descrizione_abusi` (colonne aggiunte in MySQL ma migration non eseguita su PG)
- **Soluzione:** Aggiunte le colonne mancanti con `ALTER TABLE`:
  ```sql
  ALTER TABLE valutazioni ADD COLUMN IF NOT EXISTS has_abusi BOOLEAN DEFAULT NULL;
  ALTER TABLE valutazioni ADD COLUMN IF NOT EXISTS descrizione_abusi TEXT;
  ALTER TABLE censimenti_immobili ADD COLUMN IF NOT EXISTS has_abusi BOOLEAN DEFAULT NULL;
  ALTER TABLE censimenti_immobili ADD COLUMN IF NOT EXISTS descrizione_abusi TEXT;
  ```

---

## Test funzionali: PASS

| Test                          | Risultato |
|-------------------------------|-----------|
| GET /api/health               | PASS      |
| POST /api/auth/login (admin)  | PASS      |
| GET /api/zone (349 zone)      | PASS      |
| GET /api/valutazioni (31)     | PASS      |
| GET /api/censimenti (0, vuoto)| PASS      |
| GET /api/portafoglio          | PASS      |

---

## File di backup

I file di backup sono in `data_migration_backups/` (escluso da git):
- `backup_data_mysql.sql` — dump MySQL originale (1.6 MB)
- `backup_pg_pre_import.sql` — snapshot PostgreSQL pre-import (36 KB)
- `backup_data_pg.sql` — INSERT convertiti per PostgreSQL (1.6 MB)
- `convert_mysql_to_pg.js` — script di conversione
- `import_errors.log` — log errori import (vuoto = 0 errori)

---

## Stato finale

**PRONTO PER DEPLOY**

- Database PostgreSQL `balloi` contiene tutti i dati del MySQL `omi`
- Backend Node.js funzionante e connesso a PostgreSQL
- Tutti gli endpoint API testati e funzionanti
- Sequenze allineate ai max ID corretti
- Schema aggiornato con colonne `has_abusi` / `descrizione_abusi` mancanti
