# ADR 0003 — Istanza singola, senza IP fisso, con swap

- **Data**: 25/9/2026
- **Stato**: accettata

## Contesto

L'applicazione (frontend nginx, backend Node.js, MySQL) gira in produzione su AWS con un budget di circa 1 $ al mese. Il traffico previsto è minimo: è un progetto di portfolio, acceso quando serve una demo e spento (`terraform destroy -target=aws_instance.app`) quando non serve. Ogni accensione crea quindi un'istanza nuova.

Il test di ricreazione completa del 25/9 ha fatto emergere due problemi:

1. **Memoria**: sulla `t3.micro` (1 GB di RAM, nessuno swap) MySQL veniva terminato dall'OOM killer durante l'import del dump al primo avvio. La macchina restava bloccata e l'app non partiva mai.
2. **IP pubblico variabile**: ogni istanza nuova riceve un IP diverso. `CORS_ORIGINS`, salvato nel `.env` su S3, conteneva l'IP della prima istanza, e il login falliva con "Origin non consentita dal CORS".

## Decisione

- **Una sola istanza EC2 `t3.micro`** con tutti i servizi in Docker Compose. Nessuna separazione del frontend su S3 + CloudFront, nessun load balancer, nessun RDS.
- **Swap da 2 GB** creato da `user_data.sh` prima di ogni altra operazione, e **MySQL in configurazione leggera** (`--performance-schema=OFF`, `--innodb-buffer-pool-size=128M`).
- **Crediti CPU `unlimited`** dichiarati in `ec2.tf` (prima erano impostati a mano via CLI e si perdevano a ogni ricreazione).
- **Nessun Elastic IP**: al primo avvio l'istanza legge il proprio IP pubblico dal metadata service (IMDSv2) e aggiorna `CORS_ORIGINS` nel `.env` prima di avviare i container.

## Conseguenze

Positive:
- costo minimo: niente RDS, load balancer, NAT gateway o IP fisso;
- l'avvio da zero è completamente automatico e richiede circa 2 minuti (misurato il 25/9: 126 secondi, 229 MB di swap usati durante l'avvio);
- ogni correzione è nel codice: una ricreazione non perde più impostazioni fatte a mano.

Negative e limiti accettati:
- un solo punto di guasto: se l'istanza cade, l'app non è disponibile finché non viene ricreata;
- lo swap è su disco: sotto carico sostenuto le prestazioni calerebbero (thrashing). Va bene per assorbire i picchi dell'avvio, non per un traffico reale;
- l'IP cambia a ogni ricreazione: chi usa l'app deve conoscere l'indirizzo attuale, e un dominio con HTTPS richiederebbe di aggiornare il record DNS a ogni ricreazione;
- lo script di avvio gira solo al primo avvio: dopo uno stop/start manuale l'IP cambia ma `CORS_ORIGINS` no (va corretto a mano, vedi il runbook). Per questo l'ambiente si spegne distruggendo l'istanza, non fermandola.

## Alternative considerate

- **Frontend su S3 + CloudFront, backend su EC2**: due pipeline di deploy, invalidazione della cache, CORS tra domini diversi. Più complessità senza benefici con questo traffico.
- **`t3.small` (2 GB di RAM)**: risolve la memoria senza swap, ma costa circa il doppio e non è coperta dai servizi gratuiti.
- **Elastic IP**: IP fisso, utile per un dominio, ma è un costo in più che per ora non si giustifica.
- **Rendere il CORS indipendente dall'IP nel codice** (accettare le richieste con la stessa origine dell'host): possibile, ma tocca la logica di sicurezza del backend; la soluzione nello script di avvio è più semplice da verificare.

Da rivalutare quando servirà HTTPS con un dominio, o se l'app dovesse avere utenti reali.
