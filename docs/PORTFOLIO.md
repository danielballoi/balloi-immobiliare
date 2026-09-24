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

## Giorno 6 (22/9/2026) — Le immagini Docker pubblicate su GitHub Container Registry

### Cosa e' stato fatto
- Esteso il job `docker` della pipeline CI con login automatico su GHCR (GitHub Container Registry), usando il token generato da GitHub Actions ad ogni esecuzione (`GITHUB_TOKEN`), senza creare nessun account o segreto esterno.
- Il push delle immagini avviene solo quando il codice arriva davvero su `main` (mai da una pull request), per non pubblicare immagini di codice non ancora approvato.
- Ogni immagine viene taggata due volte: `latest` e con il commit SHA esatto, cosi' si sa sempre quale immagine corrisponde a quale commit.
- Verificato che la pipeline fosse verde al primo tentativo, compreso il pezzo nuovo, e che i due pacchetti (`balloi-immobiliare-backend`, `balloi-immobiliare-frontend`) fossero davvero comparsi nella sezione Packages del repository su GitHub.
- Corretto un problema trovato riflettendo su cosa significasse davvero "pubblicato": i tre job della pipeline (`backend`, `frontend`, `docker`) giravano in parallelo, quindi il job `docker` avrebbe potuto pubblicare un'immagine anche se i test del backend fossero falliti. Aggiunto `needs: [backend, frontend]` al job `docker`, cosi' la pubblicazione parte solo se gli altri due controlli sono gia' passati.

### Una riga per il CV
Pipeline CI/CD che builda e pubblica automaticamente immagini Docker versionate su GitHub Container Registry solo dopo che test e lint sono passati, ad ogni merge su main.

### Domanda da colloquio
Perche' il push delle immagini avviene solo sugli eventi push a main e non anche sulle pull request, e perche' dipende dagli altri job?
Perche' una pull request puo' contenere codice non ancora revisionato: pubblicarne comunque l'immagine significherebbe distribuire build non verificate. E perche' senza una dipendenza esplicita (`needs`) tra i job, GitHub Actions li esegue in parallelo: un job di pubblicazione indipendente potrebbe completare e pubblicare un'immagine anche se un altro job, come i test, sta fallendo nello stesso momento.

### Da completare
- Valutare se rendere pubblici i pacchetti GHCR prima di mostrarli nel portfolio.
- Giorno 7: release automatica da tag semantico e changelog.

## Giorno 7 (23/9/2026) — Release automatica da tag semantico e chiusura dei gate di sicurezza

### Cosa e' stato fatto
- Nuovo workflow `.github/workflows/release.yml`, separato dalla CI: parte solo al push di un tag `v*.*.*`, costruisce e pubblica su GHCR le immagini taggate con la versione esatta e crea una release GitHub con changelog generato automaticamente dai messaggi di commit.
- Prima release `v0.1.0`: si parte da `0.x` perche' il progetto non e' ancora congelato; `v1.0.0` e' riservata alla consegna finale.
- Rigenerato `JWT_SECRET` con `openssl rand` scrivendolo nel file `.env` senza mai mostrarlo a schermo.
- Letto per intero il codice di autenticazione prima di valutare l'impatto della rotazione: l'access token (JWT, 15 minuti) dipende dalla chiave, il refresh token (stringa casuale verificata sul database, 30 giorni) no. Risultato: la rotazione invalida i token falsificabili con la chiave vecchia senza disconnettere gli utenti legittimi.

### Una riga per il CV
Release versionate automaticamente da tag semantici con immagini Docker e changelog generati dalla pipeline, e rotazione dei segreti JWT senza interruzione del servizio.

### Domanda da colloquio
Perche' ruotare la chiave JWT non disconnette gli utenti?
Perche' la chiave firma solo l'access token, che dura 15 minuti. Il refresh token e' una stringa casuale verificata sul database: quando l'access token viene rifiutato, il frontend usa il refresh token per ottenerne uno nuovo firmato con la chiave nuova. Chi avesse la chiave vecchia non puo' piu' falsificare token validi.

## Giorno 8 (23/9/2026) — Deploy su AWS con Terraform e un incidente reale

### Cosa e' stato fatto
- Infrastruttura AWS descritta interamente in Terraform (`infra/`): istanza EC2 `t3.micro`, security group con SSH ristretto al solo IP personale, budget da 1 $ con avvisi email, bucket S3 privato e cifrato per i backup, ruolo IAM assegnato all'istanza (nessuna chiave AWS statica sul server).
- Deploy dell'intera app (database, backend, frontend) con docker compose su una singola istanza, usando le immagini pubblicate su GHCR con una versione fissata.
- Scelta architetturale motivata: niente separazione frontend su S3+CloudFront, perche' per un progetto con traffico minimo avrebbe aggiunto complessita' senza benefici misurabili. La complessita' risparmiata e' stata investita nei backup automatici.
- Script di avvio (`user_data.sh`) che configura da solo una nuova istanza recuperando configurazione e ultimo backup da S3.
- Cinque bug di deploy diagnosticati e risolti (tra cui cookie `Secure` scartati su HTTP semplice e un bind-mount che creava una cartella al posto di un file mancante).
- Incidente reale: istanza terminata per errore dalla console. Stato verificato via AWS CLI, istanza ricreata con `terraform apply`, e ricostruita la causa di un secondo problema a cascata (inizializzazione del database interrotta a meta') partendo dai timestamp dei log.

### Una riga per il CV
Deploy su AWS con infrastruttura come codice (Terraform), backup automatici su S3 tramite ruolo IAM senza credenziali statiche, e gestione di un incidente reale in produzione con analisi delle cause.

### Domanda da colloquio
Un'istanza di produzione viene terminata per errore: come procedi?
Prima verifico lo stato reale dalle API (AWS CLI) e non solo dalla console. Poi ricreo l'infrastruttura dal codice con Terraform, che rileva da solo la risorsa mancante. Infine ricostruisco la sequenza degli eventi dai log per trovare la causa di ogni problema successivo, invece di applicare correzioni alla cieca.

## Giorno 9 (24/9/2026) — Sicurezza automatica della supply chain e bug trovati con i test

### Cosa e' stato fatto
- Attivati i controlli di sicurezza di GitHub: Dependabot (aggiornamenti settimanali di npm, Docker e GitHub Actions, con gli aggiornamenti minori raggruppati), avvisi sulle vulnerabilita', CodeQL, secret scanning con push protection, segnalazione privata delle vulnerabilita' e `SECURITY.md`.
- Il secret scanning non ha trovato nulla nell'intera cronologia: conferma indipendente della pulizia fatta al Giorno 1.
- CodeQL ha segnalato 4 problemi: permessi del token dei workflow ridotti al minimo (`contents: read`), configurazione di default di Helmet riattivata, e un avviso CSRF chiuso con motivazione scritta (gia' mitigato dai cookie `SameSite=Lax`).
- 93 avvisi sulle dipendenze ridotti a zero: prima separate le dipendenze di produzione da quelle di sviluppo con `npm audit --omit=dev`, poi corretti con aggiornamenti compatibili (`npm audit fix`), Express 4.22.3 (invece di forzare `qs` con un override) e `multer` 2.4.0 tramite pull request di Dependabot. Ogni passaggio verificato con test, build, rebuild dei container e prova nel browser.
- Scoperto che `npm audit` e Dependabot davano risultati diversi su `multer` per via del suffisso di pre-release nella versione (`1.4.5-lts.2`): due strumenti sono meglio di uno.
- Bug del rate limiter riprodotto con gli header `RateLimit-Remaining` (199 -> 197), corretto e riverificato (199 -> 198), controllando che `/refresh` restasse protetto.
- Bug trovato testando il caso di errore: un file non CSV nell'import restituiva 500. Ora gli errori di upload rispondono 400/413 con un messaggio chiaro, e i log distinguono gli errori del client da quelli del server.
- Verificato prima di correggere: il punto "log su stdout" del piano era gia' risolto, il file `server.log` era un residuo di maggio escluso da Git e dalle immagini.

### Una riga per il CV
Sicurezza della supply chain automatizzata con Dependabot, CodeQL e secret scanning; 93 avvisi di vulnerabilita' ridotti a zero con un triage basato sul rischio reale e aggiornamenti verificati.

### Domanda da colloquio
Dependabot segnala 93 vulnerabilita': da dove parti?
Non dal numero, ma dal rischio reale. Separo le dipendenze che girano in produzione da quelle usate solo per sviluppo e test, raggruppo gli avvisi per libreria (molti sono la stessa falla contata piu' volte), applico prima gli aggiornamenti compatibili e verifico con test e build, poi valuto i salti di versione major uno alla volta. E testo anche i casi di errore: e' cosi' che e' emerso un bug che i test automatici non coprivano.

### Da completare
- Verifica manuale di un import CSV reale con `multer` 2.x.
- Valutare una ad una le pull request major di Dependabot (Express 5, dotenv, ESLint, GitHub Actions); ignorare le versioni di Node dispari (non LTS).
- Content Security Policy per le pagine HTML servite da nginx.
