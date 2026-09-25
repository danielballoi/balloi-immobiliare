# Runbook — l'app online non funziona: diagnosi passo per passo

Istanza EC2 `balloi-app-server` in `eu-south-1`, app sulla porta 8080.
Regola: **dall'esterno verso l'interno**, un livello alla volta. A ogni passo guarda il risultato e segui il caso corrispondente.
Sostituisci `IP` con l'IP pubblico (`terraform output istanza_ip_pubblico`) e `i-XXX` con l'ID dell'istanza.

---

## PASSO 1 — L'app risponde?  (dal tuo PC)

```bash
curl -v --max-time 10 http://IP:8080/api/health
```

| Risultato | Significato | Vai a |
|---|---|---|
| `HTTP/1.1 200` + `{"status":"ok"}` | backend vivo e raggiungibile | **Passo 1b** (l'app funziona davvero?) |
| `HTTP/1.1 502 Bad Gateway` | nginx è su, il backend no (o nginx ha un IP vecchio del backend) | Passo 6, caso **502** |
| `HTTP/1.1 500` | il backend risponde ma va in errore | Passo 6, log del **backend** |
| `Connection refused` in pochi ms | macchina raggiungibile, nessuno ascolta sulla 8080 | Passo 2 |
| `Connection timed out` | nessuna risposta dalla macchina | Passo 2 |
| `Could not resolve host` | hai scritto un nome sbagliato al posto dell'IP | ricontrolla l'URL |
| `URL rejected: Port number...` | URL scritto male (es. `:80.it`) | formato: `http://IP:8080/percorso` |

### Passo 1b — health ok, ma l'app è davvero a posto?
Apri `http://IP:8080` nel browser.

| Sintomo | Causa probabile | Rimedio |
|---|---|---|
| "Origin non consentita dal CORS" al login | `CORS_ORIGINS` nel `.env` del server non contiene l'IP attuale (lo script di avvio lo aggiorna in automatico: se non è successo, controlla il log al Passo 5) | sul server: `sed -i 's%^CORS_ORIGINS=.*%CORS_ORIGINS=http://IP:8080%' .env`, poi `sudo docker compose up -d` e `sudo docker compose restart frontend` |
| login che torna sempre alla pagina di accesso | cookie `Secure` scartati su HTTP perché `NODE_ENV=production` | nel `.env` del server `NODE_ENV=development` (finché non c'è HTTPS), poi `docker compose up -d` |
| app vuota, niente zone/valori | dump non importato | Passo 5 (cloud-init log) e Passo 6 (conteggio righe DB) |
| pagina bianca | errore del frontend | console del browser (F12) e log del **frontend** |

---

## PASSO 2 — La macchina esiste ed è accesa?  (dal tuo PC)

```bash
aws ec2 describe-instances --region eu-south-1 --filters "Name=tag:Name,Values=balloi-app-server" --query "Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress,LaunchTime]" --output text
```

| Risultato | Significato | Cosa fare |
|---|---|---|
| **output vuoto** | nessuna istanza in quella regione | controlla la regione (`aws configure get region`) e `cd infra && terraform state list`: se manca `aws_instance.app` è stata distrutta → `terraform apply` |
| `pending` | si sta accendendo | aspetta 1-2 minuti e ripeti |
| `running` | accesa | controlla che l'IP stampato sia quello che usi, poi Passo 3 |
| `stopped` | spenta (il disco c'è ancora) | `aws ec2 start-instances --region eu-south-1 --instance-ids i-XXX` (l'IP pubblico cambia!) |
| `stopping` / `shutting-down` | si sta spegnendo o terminando | aspetta e ripeti |
| `terminated` | distrutta (sparisce dall'elenco dopo circa 1 ora) | `cd infra && terraform apply` |

**Da quanto è accesa?** Confronta `LaunchTime` (UTC, in Italia +2 ore d'estate) con `date`. Il primo avvio completo richiede circa 10-15 minuti.

---

## PASSO 3 — Cosa ha stampato all'avvio?  (dal tuo PC, senza SSH)

```bash
aws ec2 get-console-output --region eu-south-1 --instance-id i-XXX --latest --output text | tail -40
```
Il log si aggiorna con qualche minuto di ritardo.

| Nelle ultime righe vedi… | Significato | Cosa fare |
|---|---|---|
| `dnf ... Installing` / `Downloading` | sta ancora installando i pacchetti | aspetta |
| `Pulling` / `Extracting` | sta scaricando le immagini Docker | aspetta |
| `Container ... db-1 Waiting` | MySQL si sta inizializzando | aspetta 2-3 minuti |
| `Container ... frontend-1 Started` e `Dati importati da S3.` | avvio completato | torna al Passo 1 |
| `Nessun backup precedente trovato` | nessun dump su S3: DB vuoto | carica un dump sul bucket |
| `AccessDenied` su `aws s3 cp` | il ruolo IAM non ha i permessi sul bucket | controlla `backup.tf` e `aws_iam_instance_profile` in `ec2.tf` |
| `denied` / `not found` su `ghcr.io/...` | immagine inesistente o privata | verifica il tag (es. `v0.1.0`) e che il pacchetto GHCR sia pubblico |
| `imposta ... nel file .env` | manca una variabile nel `.env` scaricato da S3 | aggiorna `env/.env` sul bucket |
| niente di tutto questo, log fermo da molto | macchina bloccata | Passo 4 |

### Memoria esaurita?
```bash
aws ec2 get-console-output --region eu-south-1 --instance-id i-XXX --latest --output text | grep -i "out of memory\|oom"
```
Se compare `Out of memory: Killed process ... (mysqld)`: **RAM esaurita**. Rimedio: swap e MySQL leggero in `user_data.sh` (presenti dal 25/9), oppure un'istanza più grande (`instance_type` in `ec2.tf`, a pagamento). Una macchina in OOM va quasi sempre sostituita: `terraform apply -replace=aws_instance.app`.

---

## PASSO 4 — Posso entrare?  (dal tuo PC)

```bash
ssh -o ConnectTimeout=30 -i ~/.ssh/balloi_deploy ec2-user@IP
```
(il comando pronto: `cd infra && terraform output comando_ssh`)

| Errore | Significato | Cosa fare |
|---|---|---|
| `Connection timed out` (senza "banner") | il security group blocca il tuo IP | `curl -s https://checkip.amazonaws.com`; se il tuo IP non è in `my_ips` di `terraform.tfvars`, aggiungilo con `/32`, poi `terraform plan` e `terraform apply` |
| `timed out during banner exchange` | porta aperta, macchina troppo occupata (spesso RAM) | Passo 3, controllo memoria; aspetta o sostituisci l'istanza |
| `Connection refused` sulla 22 | SSH non ancora avviato (macchina appena accesa) | aspetta un minuto |
| `Permission denied (publickey)` | chiave o utente sbagliati | chiave `~/.ssh/balloi_deploy`, utente `ec2-user`; `chmod 600 ~/.ssh/balloi_deploy` |
| `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED` | istanza nuova con un IP già usato in passato | `ssh-keygen -R IP`, poi riprova |
| `Are you sure you want to continue connecting` | prima connessione a questa macchina | rispondi `yes` |

---

## PASSO 5 — Dentro la macchina: risorse e script di avvio  (sul server)

```bash
free -h
df -h
cloud-init status
sudo tail -50 /var/log/cloud-init-output.log
systemctl status docker
```

| Controllo | Risultato preoccupante | Significato / Rimedio |
|---|---|---|
| `free -h` | `available` vicino a 0, riga `Swap` a 0B | RAM finita e nessuno swap: vedi Passo 3, memoria |
| `df -h` | `/` al 90-100% | disco pieno: `sudo docker system prune` (rimuove immagini inutilizzate) o aumenta `volume_size` in `ec2.tf` |
| `cloud-init status` | `status: running` | lo script sta ancora girando: aspetta |
| | `status: error` | lo script è fallito: leggi le ultime righe del log qui sotto |
| | `status: done` | script finito: Passo 6 |
| `cloud-init-output.log` | l'ultima riga è un errore | con `set -e` lo script si ferma al primo errore: la riga prima dice quale comando è fallito |
| `systemctl status docker` | `inactive` / `failed` | `sudo systemctl start docker` |

---

## PASSO 6 — Dentro la macchina: i container  (sul server)

```bash
cd ~/balloi-immobiliare
sudo docker compose ps -a
```

| Stato | Significato | Cosa fare |
|---|---|---|
| `Up ... (healthy)` | tutto bene | se tutti e tre sono così, torna al Passo 1 |
| `Up ... (health: starting)` | appena partito | aspetta 1 minuto |
| `Up ... (unhealthy)` | gira ma il controllo di salute fallisce | log di quel servizio |
| `Restarting` | crasha e riparte in continuazione | log di quel servizio |
| `Exited (1)` o altro codice | si è fermato con un errore | log di quel servizio |
| `Created` (mai partito) | aspetta un servizio da cui dipende (es. backend aspetta db healthy) | guarda il servizio precedente nella catena db → backend → frontend |
| nessun container | `docker compose up` non è mai partito | manca `.env` o `db/schema.sql`: `ls -la ~/balloi-immobiliare ~/balloi-immobiliare/db` |

### I log di ogni servizio
```bash
sudo docker compose logs db --tail 50
sudo docker compose logs backend --tail 50
sudo docker compose logs frontend --tail 50
```

| Servizio | Messaggio nel log | Significato | Rimedio |
|---|---|---|---|
| db | `[Server] /usr/sbin/mysqld: ready for connections` | MySQL pronto | ok |
| db | log interrotti a metà, riavvii continui | ucciso dall'OOM killer | Passo 3, memoria |
| db | `Access denied for user` | password nel `.env` diversa da quella con cui il volume è stato creato | se i dati non servono: `sudo docker compose down -v && sudo docker compose up -d`, poi reimporta il dump |
| backend | `getaddrinfo ENOTFOUND db` / `EAI_AGAIN db` | il container `db` non esiste o non è sulla stessa rete | `sudo docker compose up -d`, controlla lo stato del db |
| backend | `Host '...' is not allowed to connect` | inizializzazione del DB interrotta a metà (utente non creato) | `sudo docker compose down -v && sudo docker compose up -d` e reimporta il dump |
| backend | `ECONNREFUSED ...:3306` | MySQL non ancora pronto | aspetta; controlla il db |
| backend | `Backend avviato su http://localhost:5000` | backend pronto | ok |
| frontend | `connect() failed ... upstream` / 502 | nginx ha l'IP vecchio del backend | `sudo docker compose restart frontend` |

### Il database contiene i dati?
```bash
sudo docker compose exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" omi -e "SELECT COUNT(*) FROM omi_zone;"'
```
Atteso: **349**. Se è 0, il dump non è stato importato:
```bash
aws s3 cp s3://balloi-immobiliare-backup-576134963750/dumps/latest.sql /tmp/dump.sql
sudo docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" omi' < /tmp/dump.sql
```

---

## Rimedi generali (dal più leggero al più drastico)

| Rimedio | Comando | Quando |
|---|---|---|
| riavviare un servizio | `sudo docker compose restart frontend` | 502, servizio bloccato |
| ricreare i container | `sudo docker compose up -d` | container fermi o mancanti |
| ripartire da un DB pulito | `sudo docker compose down -v && sudo docker compose up -d` + reimport dump | DB inizializzato male (**cancella i dati del volume**) |
| salvare i dati prima di interventi rischiosi | `~/balloi-immobiliare/backup.sh` | sempre, se il DB contiene dati nuovi |
| riavviare la macchina | `aws ec2 reboot-instances --region eu-south-1 --instance-ids i-XXX` | macchina bloccata ma da conservare |
| sostituire la macchina (rifà tutto da `user_data.sh`) | `cd infra && terraform apply -replace=aws_instance.app` | OOM, script di avvio modificato, stato irrecuperabile |

Dopo ogni rimedio: **torna al Passo 1** e verifica con `curl`.
