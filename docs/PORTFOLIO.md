# Portfolio — Diario di lavoro

Registro delle attivita svolte sul progetto Balloi Immobiliare, pensato come materiale di supporto per colloqui e CV.

---

## Giorno 1 (21/9/2026) — Igiene del repository e gestione dei segreti

### Cosa e stato fatto

- Eseguito un audit di sicurezza del repository (file tracciati, cronologia Git, dimensione del repository, presenza di dati personali nei backup locali).
- Individuate credenziali admin hardcoded nel seed di `backend/config/db.js` e in un file di configurazione locale tracciato per errore.
- Le credenziali sono state spostate in variabili d'ambiente (`ADMIN_EMAIL`, `ADMIN_PASSWORD`): il seed dell'account amministratore ora legge questi valori dall'ambiente invece di contenerli nel codice.
- Aggiunto uno script (`backend/scripts/reset_admin_password.js`) per reimpostare la password dell'amministratore senza toccare il codice sorgente.
- Il file di configurazione locale che conteneva le credenziali e stato tolto dal tracking di Git (rimane solo sul disco locale).
- Rimossi dal tracking altri file generati che non dovevano essere versionati (log, ecc.) e verificato che `.gitignore` copra tutti i pattern necessari.
- Rimossi i residui di un'ipotesi di hosting abbandonata (Vercel/Render/Neon): configurazione dei cookie di sessione resa indipendente dal deploy cross-domain e documentata via variabile d'ambiente.
- Pulizia della cronologia Git con `git filter-repo`, previo backup completo del repository (clone mirror), per eliminare dalla storia le credenziali che erano state committate in passato.
- Scritto un README principale accurato, basato sul codice effettivo (non sulla documentazione tecnica preesistente, in parte obsoleta), con architettura, funzionalita, variabili d'ambiente e istruzioni di avvio.

### Una riga per il CV

> Audit di sicurezza di un repository: individuazione e rimozione di credenziali hardcoded (spostate in variabili d'ambiente), pulizia della cronologia Git con git filter-repo e definizione di gate di sicurezza pre-rilascio.

### Domanda da colloquio

**"Hai trovato credenziali in un repo: cosa fai?"**

Risposta modello: prima si ruotano le credenziali compromesse (si presumono note a chiunque abbia avuto accesso al repository, anche se privato), poi si rimuovono dal codice sostituendole con variabili d'ambiente, poi si ripulisce la cronologia Git in modo che non restino recuperabili nei commit passati, e infine si prevengono ricadute future con controlli automatici in CI (es. secret scanning) e regole di code review.

### Da completare

La password dell'account amministratore **non e stata ancora ruotata**: e ancora quella storica che era hardcoded nel codice. Va cambiata (con `backend/scripts/reset_admin_password.js` o tramite `ADMIN_PASSWORD`) prima di qualsiasi deploy o pubblicazione del repository, dato che era presente in chiaro nel codice sorgente e nella cronologia Git.

---

## Giorno 2 (21/9/2026) — Containerizzazione con Docker e Docker Compose

### Cosa e stato fatto

- Scritto il Dockerfile del backend con build multi-stage: uno stage installa solo le dipendenze di produzione (`npm ci --omit=dev`), l'immagine finale parte da `node:22-alpine`, gira con utente non-root (`node`) e ha un `HEALTHCHECK` su `/api/health`. Il `.dockerignore` esclude `.env` e file inutili: verificato che nell'immagine non ci siano segreti.
- Scritto il Dockerfile del frontend, sempre multi-stage: la build di Vite avviene in uno stage Node, l'immagine finale contiene solo i file statici serviti da `nginx:1.27-alpine` (circa 80 MB, senza Node ne codice sorgente).
- Configurato nginx come server statico e reverse proxy: inoltra `/api/` al backend (sostituisce il proxy di Vite usato in sviluppo), gestisce il fallback della single page application, cache lunga per gli asset con hash e limite di upload a 50 MB per l'importazione dei CSV.
- Database MySQL 8.4 (immagine ufficiale) con struttura in `db/schema.sql` (dump della sola struttura, nessun dato), eseguita al primo avvio; persistenza su volume nominato; utente applicativo dedicato invece di root.
- `docker-compose.yml` con tre servizi su rete interna, ordine di avvio garantito da `depends_on` con `service_healthy`, un'unica porta pubblicata (8080) e configurazione da file `.env` non versionato, con `.env.example` come modello. Le variabili obbligatorie bloccano l'avvio se mancano.
- Segreti locali generati in modo casuale con `openssl` e mai stampati a schermo.
- Aggiunto `trust proxy` in Express, necessario ora che il backend sta dietro nginx (IP reale del client, rate limiting corretto).
- Importati nel database del container i dati OMI (15.111 valori, 349 zone, 1.393 strade) da un dump di soli dati tenuto fuori da Git; verificati i conteggi.
- Verificata la persistenza: `docker compose down` e `up` mantengono utenti e dati.
- Aggiunto `.gitattributes` per normalizzare i fine riga tra Windows e Linux, dopo aver scoperto che la differenza CRLF/LF faceva risultare modificati 51 file.

### Una riga per il CV

> Containerizzazione di un'applicazione full-stack (React, Node.js, MySQL) con Dockerfile multi-stage, utenti non-root e healthcheck, orchestrata con Docker Compose (reverse proxy nginx, volume persistente, segreti da variabili d'ambiente): intero stack avviabile con un solo comando.

### Domanda da colloquio

**"Che differenza c'e tra immagine e container? Cosa succede ai dati del database se elimini il container?"**

Risposta modello: l'immagine e il pacchetto di sola lettura costruito da un Dockerfile, il container e un'istanza in esecuzione di quell'immagine ed e usa e getta. Se i dati stessero dentro il container andrebbero persi con lui, per questo il database usa un volume nominato: `docker compose down` rimuove i container ma lascia il volume, mentre `down -v` lo cancella. Lo script di inizializzazione dello schema gira solo quando il volume e vuoto, quindi al riavvio non sovrascrive niente.

### Da completare

- Proteggere gli endpoint `/api/import/*` con autenticazione e ruolo amministratore (oggi sono aperti) e disattivare l'import da cartella in produzione.
- Correggere il rate limiter (condizione `skip` basata su `req.path`).
- Ruotare la password amministratore storica e il `JWT_SECRET` prima di qualsiasi deploy pubblico.

---

## Giorno 3 (22/9/2026) — Continuous Integration con GitHub Actions

### Cosa e stato fatto

- Creata la pipeline `.github/workflows/ci.yml`, eseguita a ogni push e pull request sul ramo main, con tre job paralleli.
- **Job backend**: avvia un service container MySQL 8.4 dedicato al test, applica `db/schema.sql`, installa le dipendenze con `npm ci`, avvia il server con `npm start` e verifica `/api/health` con un ciclo di tentativi (fino a 60 secondi), cosi' la pipeline non fallisce per un avvio lento.
- **Job frontend**: installa le dipendenze, esegue `npm run lint` (segnalato ma non bloccante, dato che il progetto non aveva ancora una pipeline di lint) e compila la SPA con `npm run build`.
- **Job docker**: ricostruisce le immagini `balloi-backend` e `balloi-frontend` dagli stessi Dockerfile usati in locale, poi valida `docker-compose.yml` con un file `.env` fittizio (segreti finti, generati ed eliminati nella macchina della CI, mai gli stessi di quelli reali).
- Aggiunto il badge di stato nel README, che riflette in tempo reale l'esito dell'ultima esecuzione.
- Prima esecuzione riuscita al primo tentativo su tutti e tre i job (circa 50 secondi il piu' lento), perche' la pipeline riusa esattamente schema, versione di Node e comandi gia' validati in locale nei giorni precedenti.

### Una riga per il CV

> Pipeline di Continuous Integration su GitHub Actions per un'app full-stack: job paralleli per backend (con database di servizio MySQL e healthcheck applicativo), frontend (lint e build) e immagini Docker, con badge di stato nel README.

### Domanda da colloquio

**"Perche' hai usato un 'service container' MySQL nella CI invece di, per esempio, un database SQLite finto o dei mock?"**

Risposta modello: perche' il codice usa query e tipi specifici di MySQL, e un database diverso o un mock non avrebbe dato garanzie reali sul comportamento in produzione. GitHub Actions permette di affiancare al job un container MySQL usa e getta, raggiungibile su localhost per tutta la durata del job: e' lo stesso principio del `docker-compose.yml` usato in locale, applicato al test. Il costo in piu' (qualche secondo di avvio) e' accettabile in cambio di un test che assomiglia davvero all'ambiente reale.

### Da completare

- Aggiungere test automatici sulla logica di valutazione (previsto nel giorno dedicato a test e protezione degli endpoint di import).
- Far diventare bloccante il lint del frontend una volta sistemati gli avvisi esistenti.
- Pubblicare l'immagine Docker su GitHub Container Registry dalla pipeline (giorno dedicato al registry).

## Giorno 4 (22/9/2026) — Sicurezza degli endpoint, un bug reale e i primi test automatici

### Cosa e' stato fatto

- Letto per intero `backend/routes/import.js`: nessuna delle dieci rotte aveva un middleware di autenticazione. Corretto applicando `router.use(requireAuth, requireAdmin)` una sola volta in cima al file, cosi' protegge automaticamente anche le rotte future; disattivato `/api/import/cartella` fuori dall'ambiente di sviluppo (legge una cartella del filesystem del server, inesistente nei container). Verificato con `curl -X POST` prima (400, nessun controllo) e dopo (401, bloccato dal middleware).
- Letti per intero i tre servizi di valutazione per progettare test basati sul codice reale, non su supposizioni. Trovato un bug vero in `calcolaReddituale`: un `if` senza parentesi graffe rendeva condizionale il `return` successivo, la funzione restituiva `undefined` quando il parametro opzionale `prezzo_acquisto` non veniva passato. Riprodotto e riverificato con `docker compose exec backend node -e "..."` prima e dopo la correzione.
- Installato Jest tramite un container Node usa e getta (l'immagine di produzione lo esclude di proposito, essendo una dipendenza di sviluppo). Scritti 20 test automatici su 3 file (`valutazioneReddituale`, `valutazioneComparativa`, `valutazioneFinanziaria`), incluso un test di regressione sul bug appena trovato; ogni numero verificato eseguendo davvero il codice prima di scriverlo in un'asserzione.
- Aggiunto `npm test` al job backend della CI, eseguito subito dopo `npm ci` e prima dell'avvio del server (fail fast), reso bloccante.
- Eseguito il lint del frontend per intero (non solo dalle annotazioni troncate di GitHub): 69 problemi reali, soprattutto componenti React dichiarati dentro il render e `setState` sincroni in `useEffect`. Deciso di non renderlo bloccante oggi: troppi per una correzione sicura in un giorno, documentato invece di ignorato. Corretto solo l'unico avviso a costo zero (due escape inutili in una regex di `Register.jsx`).

### Una riga per il CV

> Chiusa una falla di autenticazione su endpoint di scrittura del database, individuato e corretto un bug di logica tramite lettura del codice, introdotta una suite di 20 test automatici resi bloccanti in CI (fail fast) e gestito consapevolmente il debito tecnico di lint invece di ignorarlo o bloccare la pipeline senza una decisione misurata.

### Domanda da colloquio

**"Perche' hai reso bloccanti i test ma non il lint, nella stessa pipeline?"**

Risposta modello: rispondono a domande diverse — i test verificano che la logica sia corretta (un fallimento e' quasi sempre un bug reale), il lint verifica stile e alcuni pattern rischiosi. Ho eseguito il lint per intero prima di decidere, trovato 65 avvisi reali, troppi per correggerli tutti senza rischio in un giorno, e scelto di lasciarlo non bloccante ma visibile, misurando il debito con un numero preciso invece di ignorarlo o bloccare tutto d'un colpo.

### Da completare

- Ridurre a pezzi il debito di lint (componenti React dichiarati dentro il render, `setState` sincrono in `useEffect`), poi rendere il lint bloccante in CI.
- Ruotare password amministratore e `JWT_SECRET` prima del deploy pubblico.
- Log su stdout invece di `server.log`; fix del rate limiter.

---

## Giorno 5 (22/9/2026) — Strategia dati per l'istanza online

### Cosa e' stato fatto

- Verificata la licenza reale dei dati OMI (Agenzia delle Entrate) prima di decidere come popolare il database dell'istanza online: dichiarata CC BY 4.0 su dati.gov.it, ma con termini contrattuali dell'Agenzia delle Entrate piu' vaghi e la stessa ambiguita' segnalata dalla community italiana degli open data.
- Decisione documentata in un ADR (`docs/decisioni/0002-dati-istanza-online.md`): l'istanza online parte con un seed dei soli dati pubblici OMI (zone, valori, NTN, strade), con attribuzione della fonte visibile in app; le tabelle collegate a un account specifico (`valutazioni`, `portafoglio`, verificato dallo schema che hanno una colonna `user_id`) restano vuote all'avvio, non per privacy ma per evitare un remapping di id verso il nuovo account amministratore creato online, e per restare un momento di demo dal vivo.
- Creato `db/seed-pubblico-omi.sql`, esportato con `mysqldump` direttamente dal container in esecuzione (solo le quattro tabelle pubbliche), verificato che non contenga nessun'altra tabella prima di versionarlo.
- Aggiunta una riga di attribuzione della fonte OMI nel footer di `Layout.jsx`, visibile su ogni pagina dell'applicazione senza dover cercare.

### Una riga per il CV

> Verifica di conformita' di una licenza dati (Agenzia delle Entrate - OMI) prima di un deploy pubblico, decisione documentata in un Architecture Decision Record, separazione tra dati pubblici e dati legati ad account utente a livello di schema, script riproducibile di seed dei soli dati pubblici per l'ambiente online.

### Domanda da colloquio

**"Come hai deciso quali dati includere nell'istanza pubblica del progetto?"**

Risposta modello: ho verificato la licenza reale dei dati (non fidandomi della prima etichetta trovata: c'era discrepanza tra quanto dichiarato su un portale open data e i termini del sito ufficiale), poi controllato lo schema del database per capire quali tabelle fossero dati pubblici grezzi e quali legate a un account specifico. Ho documentato la decisione in un ADR con le alternative scartate, e scritto uno script separato che esporta solo le tabelle pubbliche dal database in esecuzione, cosi' il file e' riproducibile e verificabile invece di essere un dump manuale non controllato.

### Da completare

- Usare `db/seed-pubblico-omi.sql` al momento del deploy su AWS (Giorno 8).
- Se in futuro si vuole precaricare qualche valutazione di esempio sull'account online, gestire il remapping dello `user_id`.
