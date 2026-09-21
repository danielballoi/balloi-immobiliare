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
- Pulizia della cronologia Git con `git filter-repo`, previo backup completo del repository (clone mirror), per eliminare dalla storia le credenziali che erano state committate in passato.
- Scritto un README principale accurato, basato sul codice effettivo (non sulla documentazione tecnica preesistente, in parte obsoleta), con architettura, funzionalita, variabili d'ambiente e istruzioni di avvio.

### Una riga per il CV

> Audit di sicurezza di un repository: individuazione e rimozione di credenziali hardcoded (spostate in variabili d'ambiente), pulizia della cronologia Git con git filter-repo e definizione di gate di sicurezza pre-rilascio.

### Domanda da colloquio

**"Hai trovato credenziali in un repo: cosa fai?"**

Risposta modello: prima si ruotano le credenziali compromesse (si presumono note a chiunque abbia avuto accesso al repository, anche se privato), poi si rimuovono dal codice sostituendole con variabili d'ambiente, poi si ripulisce la cronologia Git in modo che non restino recuperabili nei commit passati, e infine si prevengono ricadute future con controlli automatici in CI (es. secret scanning) e regole di code review.

### Da completare

La password dell'account amministratore **non e stata ancora ruotata**: e ancora quella storica che era hardcoded nel codice. Va cambiata (con `backend/scripts/reset_admin_password.js` o tramite `ADMIN_PASSWORD`) prima di qualsiasi deploy o pubblicazione del repository, dato che era presente in chiaro nel codice sorgente e nella cronologia Git.
