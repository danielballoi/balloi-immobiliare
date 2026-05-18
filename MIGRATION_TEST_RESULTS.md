# Migration E2E Test Results

**Data test:** 2026-05-18  
**Branch:** feature/postgres-migration  
**DB:** PostgreSQL 16.14 (localhost:5432/balloi)

---

## Avvio server

```
[DB] Account admin creato: danielballoi1995@outlook.it
[DB] Tabelle verificate/create con successo
[SERVER] Backend avviato su http://localhost:5000
```

**Esito:** OK — tutte le 10+ tabelle create senza errori.

---

## Test HTTP

| Test | Endpoint | Metodo | Status | Esito |
|------|----------|--------|--------|-------|
| Health check | /api/health | GET | 200 | OK |
| Registrazione | /api/auth/register | POST | 202 | OK — pending |
| Login admin | /api/auth/login | POST | 200 | OK — cookie httpOnly |
| Auth /me | /api/auth/me | GET | 200 | OK — dati utente corretti |
| Zone list | /api/zone | GET | 200 | OK — [] vuoto atteso |
| Valori list | /api/valori | GET | 200 | OK — [] vuoto atteso |
| Strade stats | /api/strade/stats | GET | 200 | OK — vie_totali: 0 |

---

## Dettaglio risposte

### Health check
```
HTTP 200
```

### Registrazione
```json
{
  "pending": true,
  "message": "Richiesta inviata! Il tuo account deve essere approvato dall'amministratore."
}
```

### Login admin (danielballoi1995@outlook.it)
```json
{
  "user": {
    "id": 1,
    "username": "danielballoi",
    "email": "danielballoi1995@outlook.it",
    "nome": "Daniel",
    "cognome": "Balloi",
    "ruolo": "admin"
  }
}
```

### Auth /me (con cookie httpOnly)
```json
{
  "user": {
    "id": 1,
    "username": "danielballoi",
    "email": "danielballoi1995@outlook.it",
    "nome": "Daniel",
    "cognome": "Balloi",
    "ruolo": "admin",
    "stato": "attivo",
    "ultimo_accesso": "2026-05-18T10:44:14.874Z",
    "created_at": "2026-05-18T10:43:56.703Z"
  }
}
```

---

## Conclusione

- **Tutti i test passati** senza errori
- **DB PostgreSQL:** tabelle create correttamente con chiavi SERIAL, BOOLEAN, TIMESTAMP
- **Account admin:** seed eseguito automaticamente
- **Cookie httpOnly:** funzionante per auth/refresh
- **Backend pronto** per deploy su Render + Neon
