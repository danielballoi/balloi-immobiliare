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
