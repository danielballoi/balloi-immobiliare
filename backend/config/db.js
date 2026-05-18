require('dotenv').config();
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'omi',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    // Aggiunge colonne mancanti a omi_zone (idempotente: catch su duplicato)
    await conn.query(`ALTER TABLE omi_zone ADD COLUMN comune VARCHAR(100) DEFAULT 'Cagliari'`).catch(() => {});
    await conn.query(`ALTER TABLE omi_zone ADD COLUMN area   VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    // Popola area se ci sono righe senza valore
    await conn.query(`
      UPDATE omi_zone SET area = CASE WHEN UPPER(comune) = 'CAGLIARI' THEN 'CAGLIARI' ELSE 'HINTERLAND' END
      WHERE area IS NULL
    `).catch(() => {});

    // Tabella valutazioni
    await conn.query(`
      CREATE TABLE IF NOT EXISTS valutazioni (
        id INT AUTO_INCREMENT PRIMARY KEY,
        indirizzo VARCHAR(200),
        zona_codice VARCHAR(20),
        tipologia VARCHAR(100),
        stato_immobile VARCHAR(20),
        superficie_mq DECIMAL(8,2),
        piano INT,
        anno_costruzione INT,
        ascensore TINYINT(1) DEFAULT 0,
        box_auto TINYINT(1) DEFAULT 0,
        balcone_terrazza TINYINT(1) DEFAULT 0,
        cantina TINYINT(1) DEFAULT 0,
        vcm_prezzo_base_mq DECIMAL(10,2),
        vcm_coefficiente_stato DECIMAL(5,2),
        vcm_coefficiente_piano DECIMAL(5,2),
        vcm_valore_min DECIMAL(12,2),
        vcm_valore_medio DECIMAL(12,2),
        vcm_valore_max DECIMAL(12,2),
        vcm_numero_comparabili INT DEFAULT 0,
        red_canone_mensile_lordo DECIMAL(10,2),
        red_noi_annuo DECIMAL(12,2),
        red_spese_annue DECIMAL(10,2),
        red_vacancy_pct DECIMAL(5,2) DEFAULT 5.00,
        red_cap_rate_pct DECIMAL(5,2),
        red_valore_mercato DECIMAL(12,2),
        red_rendimento_lordo_pct DECIMAL(5,2),
        red_rendimento_netto_pct DECIMAL(5,2),
        dcf_prezzo_acquisto DECIMAL(12,2),
        dcf_costi_acquisto_pct DECIMAL(5,2) DEFAULT 10.00,
        dcf_costi_ristrutturazione DECIMAL(12,2) DEFAULT 0,
        dcf_capitale_investito DECIMAL(12,2),
        dcf_ltv_pct DECIMAL(5,2) DEFAULT 0,
        dcf_tasso_mutuo_pct DECIMAL(5,2) DEFAULT 0,
        dcf_durata_mutuo_anni INT DEFAULT 0,
        dcf_rata_mensile DECIMAL(10,2) DEFAULT 0,
        dcf_orizzonte_anni INT DEFAULT 5,
        dcf_tasso_crescita_noi_pct DECIMAL(5,2) DEFAULT 2.00,
        dcf_tasso_attualizzazione_pct DECIMAL(5,2) DEFAULT 6.00,
        dcf_valore_rivendita_finale DECIMAL(12,2),
        dcf_van DECIMAL(12,2),
        dcf_tir_pct DECIMAL(5,2),
        dcf_roi_totale_pct DECIMAL(5,2),
        dcf_cash_on_cash_pct DECIMAL(5,2),
        metodologia_principale VARCHAR(50),
        data_valutazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        salvato_portafoglio TINYINT(1) DEFAULT 0
      )
    `);

    // Tabella portafoglio
    await conn.query(`
      CREATE TABLE IF NOT EXISTS portafoglio (
        id INT AUTO_INCREMENT PRIMARY KEY,
        valutazione_id INT,
        indirizzo VARCHAR(200),
        zona_codice VARCHAR(20),
        tipologia VARCHAR(100),
        stato_immobile VARCHAR(20),
        superficie_mq DECIMAL(8,2),
        prezzo_acquisto DECIMAL(12,2),
        canone_mensile DECIMAL(10,2),
        vcm_valore_medio DECIMAL(12,2),
        tir_pct DECIMAL(5,2),
        roi_totale_pct DECIMAL(5,2),
        van DECIMAL(12,2),
        data_inserimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        FOREIGN KEY (valutazione_id) REFERENCES valutazioni(id) ON DELETE SET NULL
      )
    `);

    // Tabella import_log
    await conn.query(`
      CREATE TABLE IF NOT EXISTS import_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255),
        tipo VARCHAR(50),
        righe_totali INT DEFAULT 0,
        righe_importate INT DEFAULT 0,
        righe_errore INT DEFAULT 0,
        stato VARCHAR(20) DEFAULT 'pending',
        errori TEXT,
        data_import TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabella NTN (Numero Transazioni Normalizzate) - volumi di mercato OMI
    // Questo è l'unico dataset gratuito che mostra quante transazioni avvengono
    // per zona/tipologia/anno. Separato dai prezzi (omi_valori) perché è
    // un file CSV distinto pubblicato dall'Agenzia delle Entrate.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS omi_ntn (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comune VARCHAR(100) DEFAULT 'Cagliari',
        zona_codice VARCHAR(20) NOT NULL,
        fascia VARCHAR(5),
        descrizione_tipologia VARCHAR(100) NOT NULL,
        anno INT NOT NULL,
        semestre VARCHAR(10) NOT NULL,
        ntn_compravendita DECIMAL(10,3),
        ntn_locazione DECIMAL(10,3),
        data_import TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_ntn (zona_codice, descrizione_tipologia, anno, semestre)
      )
    `);

    // Tabella strade_cagliari — popolata dallo script scrape_stradario.js
    // Contiene le 1654 vie del Comune di Cagliari con il quartiere di appartenenza
    // e il collegamento alla zona OMI per i prezzi di mercato
    await conn.query(`
      CREATE TABLE IF NOT EXISTS strade_cagliari (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        via           VARCHAR(200) NOT NULL,
        quartiere     VARCHAR(100) NOT NULL,
        link_zona     VARCHAR(20)  DEFAULT NULL,
        top_cod       INT          DEFAULT NULL,
        data_scraping TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_via (via),
        INDEX idx_via_fulltext (via),
        INDEX idx_quartiere (quartiere)
      )
    `);

    // ── Tabella utenti ──────────────────────────────────────────────────────
    // stato: 'pending' → in attesa di approvazione admin
    //        'attivo'  → accesso consentito
    //        'bloccato'→ accesso negato
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        username        VARCHAR(30)  NOT NULL UNIQUE,
        email           VARCHAR(255) NOT NULL UNIQUE,
        password_hash   VARCHAR(255) NOT NULL,
        nome            VARCHAR(100) DEFAULT NULL,
        cognome         VARCHAR(100) DEFAULT NULL,
        ruolo           ENUM('admin','user') DEFAULT 'user',
        stato           ENUM('pending','attivo','bloccato') DEFAULT 'pending',
        ultimo_accesso  DATETIME     DEFAULT NULL,
        created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Aggiunge colonne nuove a tabella esistente (idempotente)
    await conn.query(`ALTER TABLE users ADD COLUMN nome    VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE users ADD COLUMN cognome VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE users ADD COLUMN stato   ENUM('pending','attivo','bloccato') DEFAULT 'pending'`).catch(() => {});

    // ── Seed account Daniel admin (idempotente) ───────────────────────────
    const [esistenti] = await conn.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      ['danielballoi1995@outlook.it']
    );
    if (esistenti.length === 0) {
      const hash = await bcrypt.hash('Daniel12345!', 12);
      await conn.query(
        'INSERT INTO users (username, email, password_hash, nome, cognome, ruolo, stato) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['danielballoi', 'danielballoi1995@outlook.it', hash, 'Daniel', 'Balloi', 'admin', 'attivo']
      );
      console.log('[DB] Account admin creato: danielballoi1995@outlook.it');
    } else {
      // Assicura che l'admin esistente sia attivo (migrazione da versioni precedenti)
      await conn.query(
        'UPDATE users SET stato = ?, ruolo = ?, nome = COALESCE(nome, ?), cognome = COALESCE(cognome, ?) WHERE email = ?',
        ['attivo', 'admin', 'Daniel', 'Balloi', 'danielballoi1995@outlook.it']
      );
    }

    // Tabella censimenti_immobili — immobili registrati manualmente dall'utente
    // stato_interesse: COMPRATO (verde) o INTERESSATO (giallo)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS censimenti_immobili (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        titolo VARCHAR(200),
        indirizzo VARCHAR(200),
        quartiere VARCHAR(100),
        tipologia VARCHAR(100),
        superficie_mq DECIMAL(8,2),
        prezzo_richiesto DECIMAL(12,2),
        stato_interesse ENUM('COMPRATO','INTERESSATO') DEFAULT 'INTERESSATO',
        stato_immobile VARCHAR(20),
        venditore VARCHAR(100),
        note TEXT,
        data_inserimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    // Aggiunge colonne extra se la tabella esisteva già (idempotenti)
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN tipo_acquisizione ENUM('ASTA','AGENZIA','PRIVATO') DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN preferito TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN link_riferimento TEXT DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN data_inizio_asta DATE DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili MODIFY COLUMN stato_interesse ENUM('COMPRATO','INTERESSATO','VENDUTO_TERZI','CEDUTO') DEFAULT 'INTERESSATO'`).catch(() => {});
    // Migrazione: rinomina vecchi valori in CEDUTO
    await conn.query(`UPDATE censimenti_immobili SET stato_interesse = 'CEDUTO' WHERE stato_interesse = 'VENDUTO_TERZI'`).catch(() => {});

    // Caratteristiche immobile e fascia OMI (idempotenti)
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN classe_energetica  VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN esposizione         VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN vista               VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN qualita_costruzione VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN luminosita          VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN stato_conservazione VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN fascia_omi          VARCHAR(10) DEFAULT NULL`).catch(() => {});

    // Specifiche fisiche e dati finanziari censimenti
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN piano                     VARCHAR(20)   DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN num_locali                INT           DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN num_bagni                 INT           DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN anno_costruzione           INT           DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN ascensore                 TINYINT(1)    DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN box_auto                  TINYINT(1)    DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN balcone_terrazza          TINYINT(1)    DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN prezzo_acquisto           DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN spese_condominiali_mensili DECIMAL(10,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN imu_annua                 DECIMAL(10,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN tari_annua                DECIMAL(10,2) DEFAULT NULL`).catch(() => {});

    // Nuovi campi: georeferenziazione, "Valuta Tu", giardino
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN citta VARCHAR(100) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN cap VARCHAR(10) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN rendita_catastale DECIMAL(10,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN giardino TINYINT(1) DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN prezzo_valutato_giusto DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN rendita_mensile_stimata DECIMAL(10,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN rendimento_annuo_stimato_pct DECIMAL(5,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN giudizio_personale VARCHAR(30) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN origine VARCHAR(50) DEFAULT 'MANUALE'`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD COLUMN url_annuncio VARCHAR(500) DEFAULT NULL`).catch(() => {});

    // Tabella locazioni_attive — contratti di affitto gestiti dall'utente
    await conn.query(`
      CREATE TABLE IF NOT EXISTS locazioni_attive (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        indirizzo VARCHAR(200),
        quartiere VARCHAR(100),
        tipologia VARCHAR(100),
        superficie_mq DECIMAL(8,2),
        canone_mensile DECIMAL(10,2),
        nome_inquilino VARCHAR(100),
        cognome_inquilino VARCHAR(100),
        email_inquilino VARCHAR(255),
        telefono_inquilino VARCHAR(30),
        data_inizio DATE,
        data_fine DATE,
        stato ENUM('ATTIVA','SCADUTA','TERMINATA') DEFAULT 'ATTIVA',
        note TEXT,
        data_inserimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Aggiunge 'VENDUTA' all'ENUM stato locazioni (per tracciare immobili venduti)
    await conn.query(`ALTER TABLE locazioni_attive MODIFY COLUMN stato ENUM('ATTIVA','SCADUTA','TERMINATA','VENDUTA') DEFAULT 'ATTIVA'`).catch(() => {});
    // Nuovi campi locazioni: tipo contratto e deposito cauzionale
    await conn.query(`ALTER TABLE locazioni_attive ADD COLUMN tipo_contratto VARCHAR(50) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE locazioni_attive ADD COLUMN deposito_cauzionale DECIMAL(10,2) DEFAULT NULL`).catch(() => {});

    // Tabella segnalazioni — messaggi inviati dagli utenti all'admin
    await conn.query(`
      CREATE TABLE IF NOT EXISTS segnalazioni (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        oggetto VARCHAR(200),
        messaggio TEXT NOT NULL,
        stato ENUM('NUOVO','LETTO') DEFAULT 'NUOVO',
        data_invio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Aggiunge user_id alle tabelle valutazioni e portafoglio (idempotente)
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN user_id INT DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN user_id INT DEFAULT NULL`).catch(() => {});

    // Caratteristiche 3 livelli + fascia OMI + tipo valutazione (idempotenti)
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN classe_energetica  VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN esposizione         VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN vista               VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN qualita_costruzione VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN luminosita          VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN stato_conservazione VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN vcm_fascia_omi      VARCHAR(10)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN vcm_punti_alti      TINYINT      DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN tipo_valutazione    VARCHAR(50)  DEFAULT NULL`).catch(() => {});

    await conn.query(`ALTER TABLE portafoglio ADD COLUMN classe_energetica  VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN esposizione         VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN vista               VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN qualita_costruzione VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN luminosita          VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN stato_conservazione VARCHAR(20)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN fascia_omi          VARCHAR(10)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN tipo_valutazione    VARCHAR(50)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN vcm_valore_min      DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN vcm_valore_max      DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN vcm_prezzo_base_mq  DECIMAL(10,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN vcm_punti_alti      TINYINT       DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN red_valore_mercato  DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN red_noi_annuo       DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN red_rendimento_lordo_pct DECIMAL(5,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN red_rendimento_netto_pct DECIMAL(5,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN dcf_van             DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN dcf_tir_pct         DECIMAL(5,2)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN dcf_roi_totale_pct  DECIMAL(5,2)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN dcf_cash_on_cash_pct DECIMAL(5,2) DEFAULT NULL`).catch(() => {});

    // Prezzo reale dichiarato e fonte (wizard analisi investimento)
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN prezzo_dichiarato DECIMAL(12,2) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN fonte_prezzo      VARCHAR(50)   DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN note_prezzo       TEXT          DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN num_locali        INT           DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN num_bagni         INT           DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD COLUMN url_annuncio      VARCHAR(500)  DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD COLUMN fonte_prezzo      VARCHAR(50)   DEFAULT NULL`).catch(() => {});

    // Tabella refresh_tokens — sessioni con token di rinnovo httpOnly
    await conn.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT          NOT NULL,
        token_hash  VARCHAR(255) NOT NULL UNIQUE,
        expires_at  DATETIME     NOT NULL,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_rt_user (user_id)
      )
    `);

    // Indici per performance — idempotenti, ignorano errore se già esistono
    await conn.query(`ALTER TABLE censimenti_immobili ADD INDEX idx_ci_user (user_id)`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD INDEX idx_ci_stato (stato_interesse)`).catch(() => {});
    await conn.query(`ALTER TABLE censimenti_immobili ADD INDEX idx_ci_val (valutazione_id)`).catch(() => {});
    await conn.query(`ALTER TABLE valutazioni ADD INDEX idx_val_user (user_id)`).catch(() => {});
    await conn.query(`ALTER TABLE portafoglio ADD INDEX idx_pf_user (user_id)`).catch(() => {});
    await conn.query(`ALTER TABLE locazioni_attive ADD INDEX idx_loc_user (user_id)`).catch(() => {});

    console.log('[DB] Tabelle verificate/create con successo');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
