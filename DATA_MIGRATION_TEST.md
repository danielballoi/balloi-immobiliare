# Data Migration Test Results

**Data migrazione:** 2026-05-18
**Branch:** feature/postgres-migration
**MySQL → PostgreSQL (balloi)**

---

## Conteggi righe: MySQL vs PostgreSQL

| Tabella              | MySQL | PostgreSQL | Match |
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

**Totale righe migrate:** 16.897 / 16.897 — **0% errori**

---

## Test API Funzionali

| Endpoint                    | Metodo | Risultato        | Note                         |
|-----------------------------|--------|------------------|------------------------------|
| /api/health                 | GET    | PASS — status ok |                              |
| /api/auth/login             | POST   | PASS — user admin restituito | email+password corretti |
| /api/zone                   | GET    | PASS — 349 zone  | Autenticato via httpOnly cookie |
| /api/valutazioni            | GET    | PASS — 31 valutazioni | Con booleans corretti  |
| /api/censimenti             | GET    | PASS — 0 (tabella vuota in MySQL) |              |
| /api/portafoglio            | GET    | PASS — 0 per utente admin | Portafoglio ha user_id NULL nel dato sorgente |

---

## Dettaglio: portafoglio user_id NULL

Le 2 righe del portafoglio in MySQL avevano già `user_id = NULL`.
Il dato è stato migrato correttamente; l'API filtra per utente loggato,
quindi restituisce 0 per admin. Non è un bug della migrazione.

---

## Sequenze PostgreSQL dopo import

| Sequenza                  | Valore |
|---------------------------|-------:|
| users_id_seq              |      8 |
| valutazioni_id_seq        |     31 |
| censimenti_immobili_id_seq|      1 |
| portafoglio_id_seq        |     26 |
| refresh_tokens_id_seq     |      5 |
| segnalazioni_id_seq       |      1 |
| locazioni_attive_id_seq   |      1 |
| import_log_id_seq         |      3 |
| omi_zone_id_seq           |    703 |
| omi_valori_id_seq         |  21379 |
| omi_ntn_id_seq            |      1 |
| strade_cagliari_id_seq    |   1583 |

---

**Stato finale: PRONTO PER DEPLOY**
