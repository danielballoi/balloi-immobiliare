# Politica di sicurezza

## Versioni supportate

Viene mantenuta solo l'ultima release pubblicata (vedi [Releases](https://github.com/danielballoi/balloi-immobiliare/releases)).

## Segnalare una vulnerabilità

**Non aprire una issue pubblica** per problemi di sicurezza.

Usa la segnalazione privata di GitHub: scheda **Security** → **Report a vulnerability**.
La segnalazione resta visibile solo a te e al maintainer finché il problema non è corretto.

Indica, se possibile:
- la parte coinvolta (backend, frontend, infrastruttura, pipeline CI/CD);
- i passi per riprodurre il problema;
- l'impatto che ritieni possibile.

Riceverai una risposta entro 7 giorni.

## Controlli automatici attivi

- **Dependabot**: aggiornamenti settimanali e avvisi immediati sulle dipendenze vulnerabili.
- **CodeQL**: analisi statica del codice a ogni push e pull request.
- **Secret scanning + push protection**: blocco dei push che contengono credenziali.
