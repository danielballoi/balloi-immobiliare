# Deploy Completo — Render (Backend) + Vercel (Frontend)

## Architettura target

```
Internet → Vercel (frontend React)
              ↓ API calls
         Render (backend Node.js) ← Neon (PostgreSQL)
```

Tutti e tre i servizi hanno tier gratuito.

---

## Prerequisiti

- Account GitHub con il repo `balloi-immobiliare`
- Account Neon con database creato (vedi NEON_SETUP.md)
- Account Render (render.com)
- Account Vercel (vercel.com)

---

## Parte 1 — Deploy Backend su Render

### 1.1 Crea nuovo Web Service

1. Vai su [render.com](https://render.com) → **New** → **Web Service**
2. Connetti il tuo repository GitHub (`balloi-immobiiare`)
3. Configura:

| Campo | Valore |
|-------|--------|
| **Name** | `balloi-backend` |
| **Root Directory** | `backend` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | Free |

### 1.2 Variabili d'ambiente

In **Environment** → **Add Environment Variable**:

```
DATABASE_URL=postgresql://USER:PASS@ep-xxx.neon.tech/neondb?sslmode=require
NODE_ENV=production
JWT_SECRET=<64 byte hex generato con crypto.randomBytes>
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://TUO-PROGETTO.vercel.app
PORT=10000
```

> Render usa la porta assegnata automaticamente — imposta `PORT=10000` o lascia
> che Render la gestisca (legge `process.env.PORT`).

### 1.3 Deploy

Clicca **Deploy** e aspetta ~3 minuti. Alla prima esecuzione:
- `initDB()` crea tutte le tabelle PostgreSQL su Neon
- L'account admin viene creato automaticamente

---

## Parte 2 — Deploy Frontend su Vercel

### 2.1 Crea nuovo progetto

1. Vai su [vercel.com](https://vercel.com) → **New Project**
2. Importa il repository GitHub
3. Configura:

| Campo | Valore |
|-------|--------|
| **Root Directory** | `frontend` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 2.2 Variabili d'ambiente frontend

In **Settings** → **Environment Variables**:

```
VITE_API_URL=https://balloi-backend.onrender.com
```

> Poi nel codice frontend usa `import.meta.env.VITE_API_URL` come base URL per le chiamate API.

### 2.3 CORS — configura dopo il deploy

Dopo che Vercel assegna l'URL (es. `https://balloi-immobiiare.vercel.app`):

1. Torna su Render → **Environment**
2. Aggiorna `CORS_ORIGINS=https://balloi-immobiiare.vercel.app`
3. Redeploy manuale (o attendi il prossimo deploy automatico)

---

## Parte 3 — Configurazione axios nel frontend

Assicurati che `frontend/src/api/` (o `axios.js`) usi la variabile d'ambiente:

```js
// frontend/src/api/index.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true, // necessario per i cookie httpOnly
});

export default api;
```

---

## Parte 4 — Verifica deploy

### Test backend
```bash
# Sostituisci con il tuo URL Render
curl https://balloi-backend.onrender.com/api/health
# Risposta attesa: {"status":"ok","timestamp":"..."}
```

### Test login
```bash
curl -X POST https://balloi-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"danielballoi1995@outlook.it","password":"Daniel12345!"}' \
  -c /tmp/cookies.txt
```

---

## Note importanti

### Cookie SameSite cross-domain

Con Render + Vercel i cookie hanno domini diversi. Potrebbe essere necessario cambiare
`sameSite: 'strict'` → `sameSite: 'none'` in `backend/routes/auth.js`:

```js
const cookieBase = {
  httpOnly: true,
  secure: true, // obbligatorio con SameSite=None
  sameSite: 'none', // necessario per cross-origin
  path: '/',
};
```

### Render Free Tier — cold start

Il piano gratuito Render sospende il servizio dopo 15 minuti di inattività.
La prima richiesta può richiedere 30-60 secondi (cold start). Per evitarlo:
- Usa [UptimeRobot](https://uptimerobot.com) per pingare il backend ogni 14 minuti
- Considera il piano starter ($7/mese) per la produzione

### Sicurezza produzione

- Cambia la password admin dalla UI dopo il primo accesso
- Ruota `JWT_SECRET` periodicamente
- Abilita 2FA sul tuo account Neon e Render
