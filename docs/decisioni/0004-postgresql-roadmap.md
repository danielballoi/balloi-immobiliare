# ADR 0004 — MySQL oggi, PostgreSQL come evoluzione

- **Data**: 25/9/2026
- **Stato**: accettata

## Contesto

Il progetto è nato su MySQL: schema creato da `initDB()` all'avvio del backend, query scritte con il driver `mysql2`, tipi e sintassi specifici di MySQL (per esempio `AUTO_INCREMENT`). I dati reali (zone OMI, valori, stradario di Cagliari) sono in un dump MySQL.

PostgreSQL è molto diffuso nei servizi gestiti (AWS RDS, Neon, Supabase) e offre funzionalità utili per questo dominio, come PostGIS per le query geografiche sulle zone.

## Decisione

**La versione 1.0 resta su MySQL 8.4.** La migrazione a PostgreSQL è pianificata come evoluzione successiva, non fatta ora.

## Motivazioni

- Migrare adesso significherebbe riscrivere schema e query e convertire i dati poco prima della consegna, senza un beneficio immediato per gli utenti.
- I test automatici oggi coprono solo la logica di valutazione, non le query: una migrazione senza test sul livello dati sarebbe rischiosa.
- La CI usa già un MySQL reale come service container, quindi il comportamento testato coincide con quello di produzione.

## Come si farebbe la migrazione

1. Aggiungere test di integrazione sulle query principali, eseguiti in CI contro il database.
2. Introdurre uno strumento di migrazioni versionate (per esempio `node-pg-migrate` o Knex) al posto della creazione delle tabelle in `initDB()`.
3. Convertire schema e query (`AUTO_INCREMENT` → `GENERATED ... AS IDENTITY`, differenze di tipi e funzioni).
4. Migrare i dati con uno strumento dedicato (per esempio `pgloader`) e confrontare i conteggi delle tabelle.
5. Eseguire la CI contro PostgreSQL, poi aggiornare Compose e l'istanza.

## Conseguenze

- Nessun rischio aggiunto prima della v1.0.
- Il passaggio richiederà un lavoro dedicato, a partire dai test sul livello dati.
