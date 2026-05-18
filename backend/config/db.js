/**
 * @file db.js
 * @description Configurazione connessione PostgreSQL con pg.Pool.
 *   Usa DATABASE_URL per la stringa di connessione (compatibile con Neon, Render, Docker).
 *   initDB() crea tutte le tabelle in modo idempotente (IF NOT EXISTS + ALTER ... IF NOT EXISTS).
 *
 * @author Balloi Immobiliare Dev
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

// ── Configurazione pool PostgreSQL ────────────────────────────────────────
// In produzione (Neon) serve SSL con rejectUnauthorized: false
const isProd = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log errori di connessione idle (non bloccano il server)
pool.on('error', (err) => {
  console.error('[DB] Errore pool inattivo:', err.message);
});

/**
 * initDB() — Crea tutte le tabelle PostgreSQL in modo idempotente.
 * Viene chiamata all'avvio del server (start() in server.js).
 * Ogni ALTER TABLE usa ADD COLUMN IF NOT EXISTS per tollerare esecuzioni ripetute.
 */
async function initDB() {
  const client = await pool.connect();
  try {
    // ── omi_zone — deve esistere prima delle FK e dei JOIN ────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS omi_zone (
        id              SERIAL PRIMARY KEY,
        comune_istat    VARCHAR(10)  DEFAULT NULL,
        comune          VARCHAR(100) DEFAULT 'Cagliari',
        fascia          VARCHAR(10)  DEFAULT NULL,
        zona            VARCHAR(20)  DEFAULT NULL,
        zona_codice     VARCHAR(20)  DEFAULT NULL,
        link_zona       VARCHAR(20)  DEFAULT NULL,
        descrizione_zona VARCHAR(200) DEFAULT NULL,
        microzona       INT          DEFAULT NULL,
        tipologia       VARCHAR(100) DEFAULT NULL,
        area            VARCHAR(20)  DEFAULT NULL,
        UNIQUE(link_zona)
      )
    `);

    // Aggiunge colonne mancanti a omi_zone (idempotente)
    await client.query(`ALTER TABLE omi_zone ADD COLUMN IF NOT EXISTS comune VARCHAR(100) DEFAULT 'Cagliari'`);
    await client.query(`ALTER TABLE omi_zone ADD COLUMN IF NOT EXISTS area   VARCHAR(20)  DEFAULT NULL`);

    // Popola area se ci sono righe senza valore
    await client.query(`
      UPDATE omi_zone SET area = CASE WHEN UPPER(comune) = 'CAGLIARI' THEN 'CAGLIARI' ELSE 'HINTERLAND' END
      WHERE area IS NULL
    `);

    // ── omi_valori — tabella prezzi OMI ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS omi_valori (
        id                    SERIAL PRIMARY KEY,
        zona_codice           VARCHAR(20),
        fascia                VARCHAR(10)  DEFAULT NULL,
        tipologia             VARCHAR(50)  DEFAULT NULL,
        descrizione_tipologia VARCHAR(100) NOT NULL,
        stato                 VARCHAR(20)  NOT NULL DEFAULT 'NORMALE',
        compr_min             DECIMAL(10,2),
        compr_max             DECIMAL(10,2),
        loc_min               DECIMAL(10,2),
        loc_max               DECIMAL(10,2),
        superficie            VARCHAR(50)  DEFAULT NULL,
        anno                  INT NOT NULL,
        semestre              VARCHAR(10)  NOT NULL,
        data_import           TIMESTAMP    DEFAULT NOW(),
        UNIQUE(zona_codice, descrizione_tipologia, stato, anno, semestre)
      )
    `);

    // ── valutazioni ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS valutazioni (
        id                            SERIAL PRIMARY KEY,
        indirizzo                     VARCHAR(200),
        zona_codice                   VARCHAR(20),
        tipologia                     VARCHAR(100),
        stato_immobile                VARCHAR(20),
        superficie_mq                 DECIMAL(8,2),
        piano                         INT,
        anno_costruzione              INT,
        ascensore                     BOOLEAN DEFAULT FALSE,
        box_auto                      BOOLEAN DEFAULT FALSE,
        balcone_terrazza              BOOLEAN DEFAULT FALSE,
        cantina                       BOOLEAN DEFAULT FALSE,
        vcm_prezzo_base_mq            DECIMAL(10,2),
        vcm_coefficiente_stato        DECIMAL(5,2),
        vcm_coefficiente_piano        DECIMAL(5,2),
        vcm_valore_min                DECIMAL(12,2),
        vcm_valore_medio              DECIMAL(12,2),
        vcm_valore_max                DECIMAL(12,2),
        vcm_numero_comparabili        INT DEFAULT 0,
        red_canone_mensile_lordo      DECIMAL(10,2),
        red_noi_annuo                 DECIMAL(12,2),
        red_spese_annue               DECIMAL(10,2),
        red_vacancy_pct               DECIMAL(5,2)  DEFAULT 5.00,
        red_cap_rate_pct              DECIMAL(5,2),
        red_valore_mercato            DECIMAL(12,2),
        red_rendimento_lordo_pct      DECIMAL(5,2),
        red_rendimento_netto_pct      DECIMAL(5,2),
        dcf_prezzo_acquisto           DECIMAL(12,2),
        dcf_costi_acquisto_pct        DECIMAL(5,2)  DEFAULT 10.00,
        dcf_costi_ristrutturazione    DECIMAL(12,2) DEFAULT 0,
        dcf_capitale_investito        DECIMAL(12,2),
        dcf_ltv_pct                   DECIMAL(5,2)  DEFAULT 0,
        dcf_tasso_mutuo_pct           DECIMAL(5,2)  DEFAULT 0,
        dcf_durata_mutuo_anni         INT           DEFAULT 0,
        dcf_rata_mensile              DECIMAL(10,2) DEFAULT 0,
        dcf_orizzonte_anni            INT           DEFAULT 5,
        dcf_tasso_crescita_noi_pct    DECIMAL(5,2)  DEFAULT 2.00,
        dcf_tasso_attualizzazione_pct DECIMAL(5,2)  DEFAULT 6.00,
        dcf_valore_rivendita_finale   DECIMAL(12,2),
        dcf_van                       DECIMAL(12,2),
        dcf_tir_pct                   DECIMAL(5,2),
        dcf_roi_totale_pct            DECIMAL(5,2),
        dcf_cash_on_cash_pct          DECIMAL(5,2),
        metodologia_principale        VARCHAR(50),
        data_valutazione              TIMESTAMP    DEFAULT NOW(),
        note                          TEXT,
        salvato_portafoglio           BOOLEAN      DEFAULT FALSE,
        user_id                       INT          DEFAULT NULL,
        classe_energetica             VARCHAR(20)  DEFAULT NULL,
        esposizione                   VARCHAR(20)  DEFAULT NULL,
        vista                         VARCHAR(20)  DEFAULT NULL,
        qualita_costruzione           VARCHAR(20)  DEFAULT NULL,
        luminosita                    VARCHAR(20)  DEFAULT NULL,
        stato_conservazione           VARCHAR(20)  DEFAULT NULL,
        vcm_fascia_omi                VARCHAR(10)  DEFAULT NULL,
        vcm_punti_alti                SMALLINT     DEFAULT NULL,
        tipo_valutazione              VARCHAR(50)  DEFAULT NULL,
        prezzo_dichiarato             DECIMAL(12,2) DEFAULT NULL,
        fonte_prezzo                  VARCHAR(50)  DEFAULT NULL,
        note_prezzo                   TEXT         DEFAULT NULL,
        num_locali                    INT          DEFAULT NULL,
        num_bagni                     INT          DEFAULT NULL,
        url_annuncio                  VARCHAR(500) DEFAULT NULL
      )
    `);

    // ── users ──────────────────────────────────────────────────────────────
    // stato: 'pending' → in attesa di approvazione admin
    //        'attivo'  → accesso consentito
    //        'bloccato'→ accesso negato
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              SERIAL PRIMARY KEY,
        username        VARCHAR(30)  NOT NULL UNIQUE,
        email           VARCHAR(255) NOT NULL UNIQUE,
        password_hash   VARCHAR(255) NOT NULL,
        nome            VARCHAR(100) DEFAULT NULL,
        cognome         VARCHAR(100) DEFAULT NULL,
        ruolo           VARCHAR(10)  DEFAULT 'user'    CHECK (ruolo IN ('admin','user')),
        stato           VARCHAR(15)  DEFAULT 'pending' CHECK (stato IN ('pending','attivo','bloccato')),
        ultimo_accesso  TIMESTAMP    DEFAULT NULL,
        created_at      TIMESTAMP    DEFAULT NOW()
      )
    `);

    // Aggiunge colonne nuove a tabella esistente (idempotente)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nome    VARCHAR(100) DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cognome VARCHAR(100) DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stato   VARCHAR(15)  DEFAULT 'pending'`);

    // ── portafoglio ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS portafoglio (
        id                       SERIAL PRIMARY KEY,
        valutazione_id           INT          DEFAULT NULL,
        user_id                  INT          DEFAULT NULL,
        indirizzo                VARCHAR(200),
        zona_codice              VARCHAR(20),
        tipologia                VARCHAR(100),
        stato_immobile           VARCHAR(20),
        superficie_mq            DECIMAL(8,2),
        prezzo_acquisto          DECIMAL(12,2),
        fonte_prezzo             VARCHAR(50)  DEFAULT NULL,
        canone_mensile           DECIMAL(10,2),
        vcm_valore_medio         DECIMAL(12,2),
        tir_pct                  DECIMAL(5,2),
        roi_totale_pct           DECIMAL(5,2),
        van                      DECIMAL(12,2),
        data_inserimento         TIMESTAMP    DEFAULT NOW(),
        note                     TEXT,
        classe_energetica        VARCHAR(20)  DEFAULT NULL,
        esposizione              VARCHAR(20)  DEFAULT NULL,
        vista                    VARCHAR(20)  DEFAULT NULL,
        qualita_costruzione      VARCHAR(20)  DEFAULT NULL,
        luminosita               VARCHAR(20)  DEFAULT NULL,
        stato_conservazione      VARCHAR(20)  DEFAULT NULL,
        fascia_omi               VARCHAR(10)  DEFAULT NULL,
        tipo_valutazione         VARCHAR(50)  DEFAULT NULL,
        vcm_valore_min           DECIMAL(12,2) DEFAULT NULL,
        vcm_valore_max           DECIMAL(12,2) DEFAULT NULL,
        vcm_prezzo_base_mq       DECIMAL(10,2) DEFAULT NULL,
        vcm_punti_alti           SMALLINT      DEFAULT NULL,
        red_valore_mercato       DECIMAL(12,2) DEFAULT NULL,
        red_noi_annuo            DECIMAL(12,2) DEFAULT NULL,
        red_rendimento_lordo_pct DECIMAL(5,2)  DEFAULT NULL,
        red_rendimento_netto_pct DECIMAL(5,2)  DEFAULT NULL,
        dcf_van                  DECIMAL(12,2) DEFAULT NULL,
        dcf_tir_pct              DECIMAL(5,2)  DEFAULT NULL,
        dcf_roi_totale_pct       DECIMAL(5,2)  DEFAULT NULL,
        dcf_cash_on_cash_pct     DECIMAL(5,2)  DEFAULT NULL,
        FOREIGN KEY (valutazione_id) REFERENCES valutazioni(id) ON DELETE SET NULL
      )
    `);

    // ── import_log ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS import_log (
        id               SERIAL PRIMARY KEY,
        filename         VARCHAR(255),
        tipo             VARCHAR(50),
        righe_totali     INT DEFAULT 0,
        righe_importate  INT DEFAULT 0,
        righe_errore     INT DEFAULT 0,
        stato            VARCHAR(20) DEFAULT 'pending',
        errori           TEXT,
        data_import      TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── omi_ntn (Numero Transazioni Normalizzate) ──────────────────────────
    // Dataset gratuito che mostra quante transazioni avvengono per zona/tipologia/anno.
    // Separato dai prezzi (omi_valori) perché è un file CSV distinto dell'Agenzia delle Entrate.
    await client.query(`
      CREATE TABLE IF NOT EXISTS omi_ntn (
        id                    SERIAL PRIMARY KEY,
        comune                VARCHAR(100) DEFAULT 'Cagliari',
        zona_codice           VARCHAR(20)  NOT NULL,
        fascia                VARCHAR(5),
        descrizione_tipologia VARCHAR(100) NOT NULL,
        anno                  INT NOT NULL,
        semestre              VARCHAR(10)  NOT NULL,
        ntn_compravendita     DECIMAL(10,3),
        ntn_locazione         DECIMAL(10,3),
        data_import           TIMESTAMP    DEFAULT NOW(),
        UNIQUE(zona_codice, descrizione_tipologia, anno, semestre)
      )
    `);

    // ── strade_cagliari ────────────────────────────────────────────────────
    // Contiene le 1654 vie del Comune di Cagliari con quartiere e zona OMI collegata.
    await client.query(`
      CREATE TABLE IF NOT EXISTS strade_cagliari (
        id            SERIAL PRIMARY KEY,
        via           VARCHAR(200) NOT NULL,
        quartiere     VARCHAR(100) NOT NULL,
        link_zona     VARCHAR(20)  DEFAULT NULL,
        top_cod       INT          DEFAULT NULL,
        data_scraping TIMESTAMP    DEFAULT NOW(),
        UNIQUE(via)
      )
    `);

    // ── Seed account Daniel admin (idempotente) ───────────────────────────
    const { rows: esistenti } = await client.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      ['danielballoi1995@outlook.it']
    );
    if (esistenti.length === 0) {
      const hash = await bcrypt.hash('Daniel12345!', 12);
      await client.query(
        'INSERT INTO users (username, email, password_hash, nome, cognome, ruolo, stato) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['danielballoi', 'danielballoi1995@outlook.it', hash, 'Daniel', 'Balloi', 'admin', 'attivo']
      );
      console.log('[DB] Account admin creato: danielballoi1995@outlook.it');
    } else {
      // Assicura che l'admin esistente sia attivo (migrazione da versioni precedenti)
      await client.query(
        'UPDATE users SET stato = $1, ruolo = $2, nome = COALESCE(nome, $3), cognome = COALESCE(cognome, $4) WHERE email = $5',
        ['attivo', 'admin', 'Daniel', 'Balloi', 'danielballoi1995@outlook.it']
      );
    }

    // ── censimenti_immobili ───────────────────────────────────────────────
    // stato_interesse: COMPRATO (verde) o INTERESSATO (giallo)
    await client.query(`
      CREATE TABLE IF NOT EXISTS censimenti_immobili (
        id                          SERIAL PRIMARY KEY,
        user_id                     INT NOT NULL,
        titolo                      VARCHAR(200),
        indirizzo                   VARCHAR(200),
        quartiere                   VARCHAR(100),
        citta                       VARCHAR(100) DEFAULT NULL,
        cap                         VARCHAR(10)  DEFAULT NULL,
        tipologia                   VARCHAR(100),
        superficie_mq               DECIMAL(8,2),
        prezzo_richiesto            DECIMAL(12,2),
        stato_interesse             VARCHAR(20)  DEFAULT 'INTERESSATO',
        stato_immobile              VARCHAR(20),
        venditore                   VARCHAR(100),
        note                        TEXT,
        data_inserimento            TIMESTAMP    DEFAULT NOW(),
        tipo_acquisizione           VARCHAR(20)  DEFAULT NULL,
        preferito                   BOOLEAN      NOT NULL DEFAULT FALSE,
        link_riferimento            TEXT         DEFAULT NULL,
        data_inizio_asta            DATE         DEFAULT NULL,
        classe_energetica           VARCHAR(20)  DEFAULT NULL,
        esposizione                 VARCHAR(20)  DEFAULT NULL,
        vista                       VARCHAR(20)  DEFAULT NULL,
        qualita_costruzione         VARCHAR(20)  DEFAULT NULL,
        luminosita                  VARCHAR(20)  DEFAULT NULL,
        stato_conservazione         VARCHAR(20)  DEFAULT NULL,
        fascia_omi                  VARCHAR(10)  DEFAULT NULL,
        piano                       VARCHAR(20)  DEFAULT NULL,
        num_locali                  INT          DEFAULT NULL,
        num_bagni                   INT          DEFAULT NULL,
        anno_costruzione            INT          DEFAULT NULL,
        ascensore                   BOOLEAN      DEFAULT FALSE,
        box_auto                    BOOLEAN      DEFAULT FALSE,
        balcone_terrazza            BOOLEAN      DEFAULT FALSE,
        giardino                    BOOLEAN      DEFAULT FALSE,
        prezzo_acquisto             DECIMAL(12,2) DEFAULT NULL,
        spese_condominiali_mensili  DECIMAL(10,2) DEFAULT NULL,
        imu_annua                   DECIMAL(10,2) DEFAULT NULL,
        tari_annua                  DECIMAL(10,2) DEFAULT NULL,
        rendita_catastale           DECIMAL(10,2) DEFAULT NULL,
        prezzo_valutato_giusto      DECIMAL(12,2) DEFAULT NULL,
        rendita_mensile_stimata     DECIMAL(10,2) DEFAULT NULL,
        rendimento_annuo_stimato_pct DECIMAL(5,2) DEFAULT NULL,
        giudizio_personale          VARCHAR(30)  DEFAULT NULL,
        origine                     VARCHAR(50)  DEFAULT 'MANUALE',
        url_annuncio                VARCHAR(500) DEFAULT NULL,
        valutazione_id              INT          DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ── locazioni_attive ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS locazioni_attive (
        id                   SERIAL PRIMARY KEY,
        user_id              INT NOT NULL,
        indirizzo            VARCHAR(200),
        quartiere            VARCHAR(100),
        tipologia            VARCHAR(100),
        superficie_mq        DECIMAL(8,2),
        canone_mensile       DECIMAL(10,2),
        nome_inquilino       VARCHAR(100),
        cognome_inquilino    VARCHAR(100),
        email_inquilino      VARCHAR(255),
        telefono_inquilino   VARCHAR(30),
        data_inizio          DATE,
        data_fine            DATE,
        stato                VARCHAR(20)  DEFAULT 'ATTIVA',
        note                 TEXT,
        data_inserimento     TIMESTAMP    DEFAULT NOW(),
        tipo_contratto       VARCHAR(50)  DEFAULT NULL,
        deposito_cauzionale  DECIMAL(10,2) DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ── segnalazioni ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS segnalazioni (
        id         SERIAL PRIMARY KEY,
        user_id    INT NOT NULL,
        oggetto    VARCHAR(200),
        messaggio  TEXT NOT NULL,
        stato      VARCHAR(10) DEFAULT 'NUOVO',
        data_invio TIMESTAMP   DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ── refresh_tokens ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          SERIAL PRIMARY KEY,
        user_id     INT          NOT NULL,
        token_hash  VARCHAR(255) NOT NULL UNIQUE,
        expires_at  TIMESTAMP    NOT NULL,
        created_at  TIMESTAMP    DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ── Indici per performance (idempotenti) ──────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ci_user  ON censimenti_immobili (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ci_stato ON censimenti_immobili (stato_interesse)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_val_user ON valutazioni (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pf_user  ON portafoglio (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_loc_user ON locazioni_attive (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rt_user  ON refresh_tokens (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_via_sc   ON strade_cagliari (via)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_qrt_sc   ON strade_cagliari (quartiere)`);

    console.log('[DB] Tabelle verificate/create con successo');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
