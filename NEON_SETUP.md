# Neon PostgreSQL — Setup per Deploy

## Cos'è Neon?

Neon è un database PostgreSQL serverless gratuito (tier free: 0.5 GB storage, 1 project).
Perfetto per deploy su Render o Vercel Functions — zero costo per progetti piccoli.

---

## Passo 1 — Crea account e database

1. Vai su [neon.tech](https://neon.tech) → **Sign Up** (usa Google o GitHub)
2. Crea un nuovo **Project** (es. "balloi-immobiliare")
3. Neon crea automaticamente:
   - Un database di default (es. `neondb`)
   - Un utente con password
   - Una connection string SSL

---

## Passo 2 — Copia la connection string

Nella dashboard Neon → **Connection Details** → copia la **Connection string**:

```
postgresql://USER:PASSWORD@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Attenzione:** la stringa ha già `?sslmode=require` — necessario per connessioni sicure.

---

## Passo 3 — Configura variabili d'ambiente su Render

Su **Render** → Dashboard → tuo servizio → **Environment**:

| Variabile | Valore |
|-----------|--------|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@...neon.tech/neondb?sslmode=require` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (genera con: `node -e "require('crypto').randomBytes(64).toString('hex')"`) |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGINS` | URL del frontend Vercel (es. `https://balloi-immobiliare.vercel.app`) |

**NON** serve `DATI_OMI_PATH` in produzione (il path locale non esiste su Render).

---

## Passo 4 — Migrazione schema automatica

Il file `backend/config/db.js` crea tutte le tabelle automaticamente all'avvio
tramite la funzione `initDB()`. Basta avviare il server con la `DATABASE_URL` di Neon.

---

## Note SSL

In `db.js` il pool è configurato con:
```js
ssl: isProd ? { rejectUnauthorized: false } : false
```

Questo è necessario perché Neon usa certificati managed. `rejectUnauthorized: false`
è sicuro per Neon (il traffico è comunque cifrato TLS).

---

## Verifica connessione da locale (opzionale)

```bash
# Installa il client psql se non presente
# Su Windows: winget install PostgreSQL.PostgreSQL.16

# Test connessione Neon
PGPASSWORD="YOUR_PASSWORD" psql "postgresql://USER@ep-xxxx.neon.tech/neondb?sslmode=require"
```

---

## Limiti tier gratuito Neon

| Risorsa | Limite |
|---------|--------|
| Storage | 512 MB |
| Compute | 0.25 vCPU (shared) |
| Connessioni | 20 max concorrenti |
| Branch DB | 10 branch |
| Inattività | Sospende dopo 5 min (cold start ~1-2s) |

Per un'app immobiliare a basso traffico questi limiti sono più che sufficienti.
