# ADR 0001 — Hosting: Docker + AWS invece di Vercel/Render/Neon

Data: 21/9/2026
Stato: accettata

## Contesto

Il progetto necessitava di un ambiente di hosting per backend, frontend e database. Una prima ipotesi prevedeva Vercel (frontend), Render (backend) e Neon (PostgreSQL), tre servizi PaaS che avrebbero permesso un deploy rapido. In quella fase era stata avviata anche una migrazione del database da MySQL a PostgreSQL per compatibilita con Neon.

Quella strada e stata abbandonata: i progetti su Vercel, Render e Neon sono stati eliminati e le relative app disinstallate da GitHub.

## Decisione

Il progetto viene containerizzato con Docker e ospitato su AWS, con infrastruttura descritta come codice. Il database resta MySQL per la versione 1.0; la migrazione a PostgreSQL rimane in roadmap ma non e piu legata a un vincolo di hosting.

## Alternative considerate

- **Vercel + Render + Neon (PaaS)**: deploy molto veloce e a basso sforzo iniziale, ma tre servizi separati da coordinare, un database diverso da quello usato in sviluppo, e poco margine per mostrare competenze di infrastruttura: gran parte del lavoro (networking, scaling, configurazione) e nascosta dalla piattaforma.
- **Docker + AWS (scelta)**: richiede piu lavoro di configurazione iniziale, ma da controllo diretto sui costi, riproducibilita dell'ambiente (stesso container in locale e in produzione) e permette di dimostrare competenze DevOps concrete (containerizzazione, infrastruttura come codice, CI/CD) — rilevante trattandosi di un progetto portfolio.

## Conseguenze

- Necessario definire Dockerfile per backend e frontend e un file docker-compose per l'ambiente locale/di test.
- Necessario definire l'infrastruttura AWS come codice (es. Terraform) invece di configurazione manuale da console.
- Il database resta MySQL: nessuna riscrittura delle query ne di `backend/config/db.js` legata al cambio di hosting.
- La migrazione a PostgreSQL, se fatta in futuro, sara una scelta tecnica indipendente e non piu una conseguenza obbligata della piattaforma di hosting.
- Il repository (pubblico, usato come portfolio) deve restare privo di configurazioni, URL o dipendenze legate a Vercel/Render/Neon per non risultare fuorviante su quale sia lo stack effettivo.
