# Documentazione Tecnica — Balloi Immobiliare
> Guida per sviluppatori junior · Versione 1.0 · Aprile 2026

---

## Indice

1. [Cos'è questa applicazione](#1-cosè-questa-applicazione)
2. [Architettura generale](#2-architettura-generale)
3. [Il Backend (Node.js + Express)](#3-il-backend-nodejs--express)
4. [Il Database (MySQL)](#4-il-database-mysql)
5. [I Calcoli Immobiliari (Services)](#5-i-calcoli-immobiliari-services)
6. [Il Frontend (React + Vite)](#6-il-frontend-react--vite)
7. [Come i dati fluiscono nell'app](#7-come-i-dati-fluiscono-nellapp)
8. [Come avviare l'applicazione](#8-come-avviare-lapplicazione)
9. [Struttura delle cartelle](#9-struttura-delle-cartelle)
10. [Glossario termini immobiliari](#10-glossario-termini-immobiliari)

---

## 1. Cos'è questa applicazione

Balloi Immobiliare è una **dashboard web per l'analisi del mercato immobiliare di Cagliari**.

Permette di:
- **Visualizzare** i prezzi immobiliari su una mappa interattiva (dati OMI)
- **Analizzare** le statistiche di una zona (prezzi, canoni, trend storici)
- **Valutare** un immobile con 3 metodologie professionali (VCM, Reddituale, DCF)
- **Importare** dati OMI ufficiali tramite CSV
- **Gestire** un portafoglio di investimenti immobiliari

> **OMI** = Osservatorio del Mercato Immobiliare, gestito dall'Agenzia delle Entrate.
> Pubblica semestralmente i prezzi medi di compravendita e locazione per ogni zona d'Italia.

---

## 2. Architettura generale

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTENTE (Browser)                          │
│                    http://localhost:3000                          │
└──────────────────────────────┬──────────────────────────────────┘
                                │ HTTP (JSON)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               FRONTEND  (React + Vite)                           │
│  Porta 3000 · src/pages/ · src/components/ · src/services/api.js│
│  In sviluppo: Vite proxia automaticamente /api → porta 5000      │
└──────────────────────────────┬──────────────────────────────────┘
                                │ HTTP /api/... (proxy Vite)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND  (Node.js + Express)                       │
│  Porta 5000 · server.js · routes/ · services/ · middleware/      │
└──────────────────────────────┬──────────────────────────────────┘
                                │ SQL (mysql2)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               DATABASE  (MySQL)                                   │
│  DB: omi · Tabelle: omi_zone, omi_valori, valutazioni,           │
│  portafoglio, import_log                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Perché questa architettura?**
- Separare frontend e backend ti permette di lavorare su uno senza toccare l'altro
- Il proxy Vite evita problemi di CORS in sviluppo: il browser vede tutto sullo stesso host
- Express è leggero e perfetto per API REST (ciò che fa questa app)

---

## 3. Il Backend (Node.js + Express)

### Cos'è Express?

Express è un framework per creare **server HTTP** in Node.js. Ogni volta che il browser chiede
`GET /api/zone`, Express sa quale funzione eseguire e cosa rispondere.

### Struttura delle route

```
backend/
  server.js              ← Punto di avvio del server
  config/
    db.js                ← Configurazione connessione MySQL + creazione tabelle
  routes/
    zone.js              ← /api/zone      - Zone OMI e dati per la mappa
    valori.js            ← /api/valori    - Valori OMI (prezzi per zona/tipologia)
    valutazioni.js       ← /api/valutazioni - Calcoli e storico valutazioni
    portafoglio.js       ← /api/portafoglio - Gestione immobili salvati
    import.js            ← /api/import   - Upload CSV e inserimento manuale
  services/
    valutazioneComparativa.js  ← Logica calcolo VCM
    valutazioneReddituale.js   ← Logica calcolo reddituale
    valutazioneFinanziaria.js  ← Logica calcolo DCF (IRR, NPV)
  middleware/            ← (riservato per future espansioni: auth, rate limiting)
  .env                   ← Variabili d'ambiente (credenziali DB, porta)
```

### Come funziona una route (esempio)

```javascript
// routes/zone.js
router.get('/', async (req, res, next) => {
  try {
    // 1. Legge parametri dalla querystring: /api/zone?comune=Cagliari
    const { comune = 'Cagliari' } = req.query;

    // 2. Esegue query SQL sul database
    const [rows] = await pool.query('SELECT ... FROM omi_zone WHERE comune = ?', [comune]);

    // 3. Risponde con JSON
    res.json(rows);
  } catch (err) {
    // 4. In caso di errore, passa a Express che lo gestisce con res.status(500)
    next(err);
  }
});
```

### Il middleware di error handling

In `server.js` c'è questo pezzo di codice:

```javascript
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err.message });
});
```

Qualsiasi `next(err)` nelle route arriva qui. È un "catch globale" dell'applicazione.

### Il file .env

Il file `.env` contiene le variabili d'ambiente: dati sensibili che non vanno mai
committati su Git (es: password database). Il pacchetto `dotenv` le carica in
`process.env.NOME_VARIABILE`.

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=omi
PORT=5000
```

---

## 4. Il Database (MySQL)

### Tabelle principali

#### `omi_zone` — Zone geografiche OMI
```sql
id              INT           → ID univoco
link_zona       VARCHAR(20)   → Codice OMI (es. "D12")
descrizione_zona VARCHAR(100) → Nome leggibile (es. "Marina")
lat, lng        DECIMAL       → Coordinate GPS del centroide zona
comune          VARCHAR(100)  → Nome comune (default: Cagliari)
area_geojson    TEXT          → Poligono zona in formato GeoJSON (opzionale)
```

#### `omi_valori` — Prezzi di mercato per zona e tipologia
```sql
zona_codice         VARCHAR(20)   → Collega a omi_zone.link_zona
descrizione_tipologia VARCHAR(100) → Es. "Abitazioni civili", "Uffici"
stato               VARCHAR(20)   → "NORMALE", "OTTIMO", "SCADENTE"
anno                INT           → Anno rilevazione
semestre            INT           → 1 o 2
compravendita_min   DECIMAL       → €/mq minimo compravendita
compravendita_max   DECIMAL       → €/mq massimo compravendita
locazione_min       DECIMAL       → €/mq/mese minimo locazione
locazione_max       DECIMAL       → €/mq/mese massimo locazione
```

#### `valutazioni` — Valutazioni salvate dall'utente
Questa tabella ha molte colonne perché salva **tutti i parametri e risultati** di una
valutazione completa (VCM + Reddituale + DCF). Le colonne sono prefissate:
- `vcm_*` → dati della Valutazione Comparativa di Mercato
- `red_*` → dati della valutazione Reddituale
- `dcf_*` → dati dell'analisi DCF

#### `portafoglio` — Immobili nel portafoglio dell'utente
Subset semplificato di una valutazione, con i KPI principali.

#### `import_log` — Log delle importazioni CSV
Tiene traccia di ogni import: file caricato, quante righe OK, quante con errore.

### Connessione con Connection Pool

```javascript
// config/db.js
const pool = mysql.createPool({
  connectionLimit: 10,  // Max 10 connessioni contemporanee
  ...
});
```

Invece di aprire/chiudere una connessione per ogni query, il **pool** mantiene un gruppo
di connessioni aperte e le riusa. È molto più efficiente: aprire una connessione TCP
costa decine di millisecondi.

---

## 5. I Calcoli Immobiliari (Services)

I tre service in `backend/services/` contengono la logica dei calcoli.
Sono funzioni pure (non toccano il database direttamente, tranne VCM che legge i dati OMI).

### 5.1 Valutazione Comparativa di Mercato (VCM)

**Domanda**: "Quanto vale questo appartamento secondo i prezzi di mercato della zona?"

```
Valore = Prezzo_base_OMI × Coeff_piano × (1 + Somma_coeff_dotazioni) × Superficie_mq
```

**Esempio pratico**:
- Zona D12, 80 mq, 3° piano, con ascensore e balcone
- Prezzo base OMI: €1.800/mq
- Coeff. piano 3: 1.02 (+2%)
- Coeff. ascensore: +4%, balcone: +3% → tot +7%
- Valore = 1.800 × 1.02 × 1.07 × 80 = **€158.832**

### 5.2 Valutazione Reddituale

**Domanda**: "Se affitto questo immobile, quanto vale in base al reddito che genera?"

```
NOI (Net Operating Income) = Canone_annuo × (1 - Vacancy%) - Spese_operative
Valore = NOI / Cap_Rate
```

Il **Cap Rate** è il tasso di rendimento richiesto dal mercato per quel tipo di immobile.
Un Cap Rate del 5% significa che il mercato si aspetta un rendimento netto del 5% annuo.

**Esempio pratico**:
- Canone: €800/mese → €9.600 annui
- Vacancy 5%: -€480 → €9.120 effettivi
- Spese (IMU, manutenzione): -€1.000 → NOI = €8.120
- Cap Rate 5%: Valore = 8.120 / 0.05 = **€162.400**

### 5.3 Analisi DCF (Discounted Cash Flow)

**Domanda**: "Considerando tutti i flussi di cassa futuri (affitti + rivendita), questo investimento conviene?"

Metriche prodotte:

| Metrica | Cos'è | Interpretazione |
|---------|--------|-----------------|
| **VAN** (NPV) | Valore attuale di tutti i flussi futuri meno l'investimento iniziale | VAN > 0 = investi, VAN < 0 = evita |
| **TIR** (IRR) | Il tasso di rendimento effettivo dell'investimento | Confrontalo col costo del capitale (es. 6%): se TIR > 6% è buono |
| **ROI** | Guadagno totale / capitale investito | Quante volte hai moltiplicato i tuoi soldi |
| **Cash-on-Cash** | Flusso di cassa anno 1 / equity investita | Quanto cash generi subito sull'equity |

**Come funziona il TIR**: è calcolato con il metodo Newton-Raphson (algoritmo iterativo
che trova il tasso `r` tale che VAN = 0). È lo stesso calcolo che usa Excel con `=TIR()`.

---

## 6. Il Frontend (React + Vite)

### Cos'è React?

React è una libreria per costruire interfacce utente. L'idea fondamentale:
> "Descrivi come vuoi che l'UI appaia **in base allo stato** — React si occupa di aggiornare il DOM"

Invece di scrivere `document.getElementById('prezzo').innerText = '€150.000'`,
con React scrivi:
```jsx
const [prezzo, setPrezzo] = useState(150000);
return <p>€{prezzo.toLocaleString()}</p>;
```
E quando cambia `prezzo`, React aggiorna automaticamente il DOM.

### Cos'è Vite?

Vite è il **build tool**: compila/ottimizza il codice React per il browser.
In sviluppo fa anche da server con HMR (Hot Module Replacement): ogni volta che salvi
un file, il browser si aggiorna istantaneamente senza ricaricare tutta la pagina.

### React Router

Gestisce la navigazione senza ricaricare la pagina (SPA - Single Page Application):

```jsx
// App.jsx
<Route path="/valutazione" element={<WizardValutazione />} />
```

Quando l'utente clicca su "Wizard Valutazione", React Router:
1. Cambia l'URL del browser a `/valutazione`
2. Smonta il componente precedente
3. Monta `<WizardValutazione />`
...tutto senza nessuna richiesta HTTP per l'HTML della pagina!

### Struttura componenti

```
src/
  App.jsx               ← Router principale
  components/
    Layout.jsx          ← Wrapper: sidebar + header + <Outlet>
    Sidebar.jsx         ← Menu navigazione (usa NavLink)
    StatCard.jsx        ← Card KPI riutilizzabile
    LoadingSpinner.jsx  ← Spinner caricamento
    EmptyState.jsx      ← Stato vuoto lista
  pages/
    DashboardMappa.jsx  ← Mappa Leaflet con heatmap zone
    StatisticheQuartiere.jsx ← Grafici Recharts + tabella statistiche
    ImportDati.jsx      ← Drag&drop CSV + form manuale
    WizardValutazione.jsx ← Wizard 4 step con calcoli
    MieiInvestimenti.jsx  ← Portafoglio immobili
    Impostazioni.jsx    ← Stato sistema
  services/
    api.js              ← Tutte le chiamate HTTP (Axios)
```

### Hook useState e useEffect

```jsx
// useState: variabile di stato reattiva
const [zone, setZone] = useState([]);  // zone = [], setZone = funzione per cambiarla

// useEffect: esegui codice quando qualcosa cambia
useEffect(() => {
  // Questo codice gira UNA VOLTA al montaggio del componente (dipendenze = [])
  getZone().then(data => setZone(data));
}, []);  // ← array di dipendenze vuoto = solo al mount
```

### Axios e la gestione delle API

```javascript
// services/api.js
const api = axios.create({ baseURL: '/api' });

// Ogni funzione è un wrapper della chiamata HTTP:
export const getZone = () => api.get('/zone').then(r => r.data);
```

Nel componente:
```jsx
const [zone, setZone] = useState([]);

useEffect(() => {
  getZone()                     // chiama GET /api/zone
    .then(data => setZone(data)) // aggiorna lo stato → React re-renderizza
    .catch(err => console.error(err));
}, []);
```

### Tailwind CSS

Tailwind è un framework CSS "utility-first": invece di scrivere classi CSS custom,
usi classi predefinite direttamente nell'HTML:

```jsx
// Senza Tailwind:
<div className="card">...</div>
// CSS: .card { background: #1e2130; border-radius: 12px; padding: 16px; }

// Con Tailwind:
<div className="rounded-xl p-4" style={{ background: 'var(--bg-card)' }}>...</div>
```

Le variabili CSS (`--bg-card`, `--accent`, ecc.) sono definite in `index.css`
e permettono di centralizzare il tema scuro.

---

## 7. Come i dati fluiscono nell'app

Esempio completo: **l'utente fa una valutazione VCM**

```
1. Utente apre /valutazione nel browser
   → React Router monta <WizardValutazione />
   → useEffect carica zone e tipologie dal backend

2. Utente compila Step 1 (zona, tipologia, mq, piano)
   → Ogni campo onChange aggiorna lo stato React con upd()

3. Utente clicca "Calcola VCM"
   → eseguiVCM() viene chiamata
   → await calcolaVCM({...dati...})
   → Axios fa POST /api/valutazioni/calcola-vcm

4. Backend riceve la richiesta
   → routes/valutazioni.js → calcolaVCM()
   → services/valutazioneComparativa.js:
     → Query SQL su omi_valori per trovare comparabili
     → Applica coefficienti piano e dotazioni
     → Calcola range min/medio/max
   → Risponde con JSON { valore_min: 140000, valore_medio: 158000, ... }

5. Frontend riceve il risultato
   → upd('vcm', risultato) aggiorna lo stato
   → setStepAttivo(2) avanza al prossimo step
   → React re-renderizza mostrando i valori calcolati

6. Utente clicca "Aggiungi al Portafoglio"
   → salvaRisultati(true)
   → POST /api/valutazioni/salva → INSERT in tabella valutazioni
   → POST /api/portafoglio → INSERT in tabella portafoglio
   → navigate('/portafoglio') porta l'utente al portafoglio
```

---

## 8. Come avviare l'applicazione

### Prerequisiti

- Node.js >= 18
- MySQL con database `omi` creato e popolato con dati OMI
- Le tabelle `omi_zone` e `omi_valori` devono esistere e avere dati

### Avvio Backend

```bash
cd backend
npm install          # installa dipendenze (solo prima volta)
npm run dev          # avvia con nodemon (riavvio automatico)
# oppure
npm start            # avvia senza hot-reload
```

Il backend è pronto quando vedi:
```
[DB] Tabelle verificate/create con successo
[SERVER] Backend avviato su http://localhost:5000
```

### Avvio Frontend

```bash
cd frontend
npm install          # installa dipendenze (solo prima volta)
npm run dev          # avvia Vite dev server
```

Il frontend è raggiungibile su http://localhost:3000

### Verifica funzionamento

Apri il browser su http://localhost:3000/api/health — dovresti vedere:
```json
{"status": "ok", "timestamp": "2026-04-19T..."}
```

---

## 9. Struttura delle cartelle

```
balloi-immobiiare/
│
├── backend/                      ← Server Node.js
│   ├── server.js                 ← Punto di avvio: configura Express, monta routes
│   ├── .env                      ← Variabili ambiente (non committare!)
│   ├── package.json              ← Dipendenze backend
│   ├── config/
│   │   └── db.js                 ← Pool MySQL + creazione tabelle
│   ├── routes/
│   │   ├── zone.js               ← Endpoints zone OMI
│   │   ├── valori.js             ← Endpoints valori prezzi OMI
│   │   ├── valutazioni.js        ← Endpoints calcoli e storico
│   │   ├── portafoglio.js        ← Endpoints gestione portafoglio
│   │   └── import.js             ← Endpoints import CSV e manuale
│   └── services/
│       ├── valutazioneComparativa.js  ← Algoritmo VCM
│       ├── valutazioneReddituale.js   ← Algoritmo reddituale
│       └── valutazioneFinanziaria.js  ← Algoritmo DCF (IRR/NPV)
│
└── frontend/                     ← App React
    ├── index.html                ← HTML base (contiene div#root)
    ├── vite.config.js            ← Config Vite (proxy, porta)
    ├── package.json              ← Dipendenze frontend
    └── src/
        ├── main.jsx              ← Entry point React
        ├── App.jsx               ← Router principale
        ├── index.css             ← Stili globali + variabili tema
        ├── components/           ← Componenti riutilizzabili
        │   ├── Layout.jsx        ← Shell: sidebar + contenuto
        │   ├── Sidebar.jsx       ← Menu navigazione
        │   ├── StatCard.jsx      ← Card KPI
        │   ├── LoadingSpinner.jsx
        │   └── EmptyState.jsx
        ├── pages/                ← Una cartella per ogni pagina
        │   ├── DashboardMappa.jsx
        │   ├── StatisticheQuartiere.jsx
        │   ├── ImportDati.jsx
        │   ├── WizardValutazione.jsx
        │   ├── MieiInvestimenti.jsx
        │   └── Impostazioni.jsx
        └── services/
            └── api.js            ← Tutte le chiamate HTTP centralizzate
```

---

## 10. Glossario termini immobiliari

| Termine | Significato |
|---------|-------------|
| **OMI** | Osservatorio Mercato Immobiliare — fonte dati prezzi ufficiali dell'Agenzia Entrate |
| **VCM** | Valutazione Comparativa di Mercato — stima basata su prezzi di immobili simili |
| **Cap Rate** | Capitalization Rate — rendimento netto su valore: es 5% = €5.000 NOI per €100.000 valore |
| **NOI** | Net Operating Income — reddito netto operativo (affitto - vacancy - spese) |
| **DCF** | Discounted Cash Flow — metodo che attualizza i flussi di cassa futuri |
| **VAN / NPV** | Valore Attuale Netto / Net Present Value — se > 0 l'investimento crea valore |
| **TIR / IRR** | Tasso Interno di Rendimento / Internal Rate of Return — rendimento effettivo annuo |
| **LTV** | Loan-To-Value — percentuale del valore finanziata con mutuo (es. 70%) |
| **ROI** | Return on Investment — guadagno totale percentuale sul capitale investito |
| **Cash-on-Cash** | Rendimento del flusso di cassa sull'equity nel primo anno |
| **Vacancy** | Tasso di sfitto — percentuale di tempo in cui l'immobile non è affittato |
| **Equity** | La quota dell'investimento pagata con soldi propri (non finanziata) |
| **CAPEX** | Capital Expenditure — spese straordinarie (es: ristrutturazione, nuovo tetto) |

---

*Documentazione generata in accompagnamento al codice sorgente dell'applicazione.*
