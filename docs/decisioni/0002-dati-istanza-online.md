# ADR 0002 — Dati per l'istanza online: seed pubblico OMI, nessun dato personale

Data: 22/9/2026
Stato: accettata

## Contesto

L'istanza online del progetto (deploy previsto su AWS, Giorno 8) parte con un database vuoto se non decidiamo diversamente. Un database vuoto rende poco impressionante la prima visita di un recruiter o di chiunque guardi il portfolio: mappa e statistiche non mostrerebbero nulla finché qualcuno non importa dei dati a mano.

Il progetto usa dati OMI (Osservatorio del Mercato Immobiliare, Agenzia delle Entrate): zone, valori di compravendita/locazione, volumi NTN. La licenza dichiarata su dati.gov.it è CC BY 4.0 (uso ed elaborazione consentiti, citando la fonte), ma i termini contrattuali pubblicati sul sito dell'Agenzia delle Entrate non indicano una licenza altrettanto esplicita, e la community italiana open data (discussione su forum.italia.it) segnala la stessa ambiguità. Non è un divieto netto, ma nemmeno una garanzia legale al 100%.

Il database locale contiene anche `valutazioni` e `portafoglio`, generate usando l'app: verificato dallo schema (`db/schema.sql`) che entrambe le tabelle hanno una colonna `user_id`, quindi sono legate a un account specifico e non condivise tra utenti diversi.

## Decisione

L'istanza online viene popolata all'avvio (seed) solo con le tabelle di dati pubblici OMI: `omi_zone`, `omi_valori`, `omi_ntn`, più `strade_cagliari` (indice stradale, dato amministrativo/cartografico, non OMI). L'app mostra una citazione della fonte ("Fonte: Agenzia delle Entrate — Osservatorio del Mercato Immobiliare") in modo visibile, per rispettare la condizione di attribuzione della licenza dichiarata.

`valutazioni`, `portafoglio`, `censimenti_immobili` e `locazioni_attive` restano vuote al primo avvio. Non per un problema di privacy o di licenza (sono legate a un account, non pubbliche, e derivano da elaborazione propria dei dati OMI, esplicitamente permessa) ma per un motivo tecnico: l'account admin online viene creato da zero all'avvio del container (da `ADMIN_EMAIL`/`ADMIN_PASSWORD`), e precaricare righe con lo `user_id` dell'account locale richiederebbe un remapping per essere sicuri che corrisponda al nuovo id. Restano quindi il posto naturale per una dimostrazione dal vivo (demo, video colloquio) invece che dati già pronti.

## Alternative considerate

- **Database completamente vuoto, solo demo import dal vivo**: rischio zero, nessun dato OMI ridistribuito, ma la prima impressione per chi visita l'app senza guida è una dashboard vuota.
- **Seed con solo dati non-OMI** (`strade_cagliari` e zone geografiche, senza i valori OMI veri): rischio quasi nullo, ma statistiche e valutazioni di zona non avrebbero numeri reali da mostrare.
- **Seed con dati OMI grezzi + attribuzione (scelta)**: la dashboard è subito popolata e credibile, il rischio legale residuo è mitigato (non eliminato) dall'attribuzione esplicita e dal fatto che si tratta di un progetto personale non commerciale.

## Conseguenze

- Serve uno script che esporta solo le tabelle pubbliche dal dump locale, separato dai dati privati (`data_migration_backups/`), da usare come seed al momento del deploy (Giorno 8).
- Il frontend deve mostrare la citazione della fonte OMI in un punto visibile (es. footer o vicino alle statistiche di zona).
- Se in futuro si vuole precaricare qualche valutazione di esempio sull'account online, va gestito il remapping dello `user_id` verso il nuovo account admin, non copiato da locale as-is.
- Nessuna tabella con dati personali (`users`, `segnalazioni`, `refresh_tokens`) entra mai nel seed pubblico — resta valido il gate di sicurezza già definito nel piano.
