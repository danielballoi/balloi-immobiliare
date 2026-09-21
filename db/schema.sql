
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `censimenti_immobili`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `censimenti_immobili` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `titolo` varchar(200) DEFAULT NULL,
  `indirizzo` varchar(200) DEFAULT NULL,
  `quartiere` varchar(100) DEFAULT NULL,
  `tipologia` varchar(100) DEFAULT NULL,
  `superficie_mq` decimal(8,2) DEFAULT NULL,
  `prezzo_richiesto` decimal(12,2) DEFAULT NULL,
  `stato_interesse` enum('COMPRATO','INTERESSATO','VENDUTO_TERZI','CEDUTO') DEFAULT 'INTERESSATO',
  `stato_immobile` varchar(20) DEFAULT NULL,
  `venditore` varchar(100) DEFAULT NULL,
  `note` text,
  `data_inserimento` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo_acquisizione` enum('ASTA','AGENZIA','PRIVATO') DEFAULT NULL,
  `preferito` tinyint(1) NOT NULL DEFAULT '0',
  `link_riferimento` text,
  `data_inizio_asta` date DEFAULT NULL,
  `classe_energetica` varchar(20) DEFAULT NULL,
  `esposizione` varchar(20) DEFAULT NULL,
  `vista` varchar(20) DEFAULT NULL,
  `qualita_costruzione` varchar(20) DEFAULT NULL,
  `luminosita` varchar(20) DEFAULT NULL,
  `stato_conservazione` varchar(20) DEFAULT NULL,
  `fascia_omi` varchar(10) DEFAULT NULL,
  `piano` varchar(20) DEFAULT NULL,
  `num_locali` int DEFAULT NULL,
  `num_bagni` int DEFAULT NULL,
  `anno_costruzione` int DEFAULT NULL,
  `ascensore` tinyint(1) DEFAULT '0',
  `box_auto` tinyint(1) DEFAULT '0',
  `balcone_terrazza` tinyint(1) DEFAULT '0',
  `prezzo_acquisto` decimal(12,2) DEFAULT NULL,
  `spese_condominiali_mensili` decimal(10,2) DEFAULT NULL,
  `imu_annua` decimal(10,2) DEFAULT NULL,
  `tari_annua` decimal(10,2) DEFAULT NULL,
  `citta` varchar(100) DEFAULT NULL,
  `cap` varchar(10) DEFAULT NULL,
  `rendita_catastale` decimal(10,2) DEFAULT NULL,
  `giardino` tinyint(1) DEFAULT '0',
  `prezzo_valutato_giusto` decimal(12,2) DEFAULT NULL,
  `rendita_mensile_stimata` decimal(10,2) DEFAULT NULL,
  `rendimento_annuo_stimato_pct` decimal(5,2) DEFAULT NULL,
  `giudizio_personale` varchar(30) DEFAULT NULL,
  `origine` varchar(50) DEFAULT 'MANUALE',
  `url_annuncio` varchar(500) DEFAULT NULL,
  `valutazione_id` int DEFAULT NULL,
  `has_abusi` tinyint(1) DEFAULT NULL,
  `descrizione_abusi` text,
  PRIMARY KEY (`id`),
  KEY `idx_ci_user` (`user_id`),
  KEY `idx_ci_stato` (`stato_interesse`),
  KEY `idx_ci_val` (`valutazione_id`),
  CONSTRAINT `censimenti_immobili_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `import_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `import_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) DEFAULT NULL,
  `tipo` varchar(50) DEFAULT NULL,
  `righe_totali` int DEFAULT '0',
  `righe_importate` int DEFAULT '0',
  `righe_errore` int DEFAULT '0',
  `stato` varchar(20) DEFAULT 'pending',
  `errori` text,
  `data_import` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `locazioni_attive`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locazioni_attive` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `indirizzo` varchar(200) DEFAULT NULL,
  `quartiere` varchar(100) DEFAULT NULL,
  `tipologia` varchar(100) DEFAULT NULL,
  `superficie_mq` decimal(8,2) DEFAULT NULL,
  `canone_mensile` decimal(10,2) DEFAULT NULL,
  `nome_inquilino` varchar(100) DEFAULT NULL,
  `cognome_inquilino` varchar(100) DEFAULT NULL,
  `email_inquilino` varchar(255) DEFAULT NULL,
  `telefono_inquilino` varchar(30) DEFAULT NULL,
  `data_inizio` date DEFAULT NULL,
  `data_fine` date DEFAULT NULL,
  `stato` enum('ATTIVA','SCADUTA','TERMINATA','VENDUTA') DEFAULT 'ATTIVA',
  `note` text,
  `data_inserimento` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `tipo_contratto` varchar(50) DEFAULT NULL,
  `deposito_cauzionale` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_loc_user` (`user_id`),
  CONSTRAINT `locazioni_attive_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `omi_ntn`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `omi_ntn` (
  `id` int NOT NULL AUTO_INCREMENT,
  `comune` varchar(100) DEFAULT 'Cagliari',
  `zona_codice` varchar(20) NOT NULL,
  `fascia` varchar(5) DEFAULT NULL,
  `descrizione_tipologia` varchar(100) NOT NULL,
  `anno` int NOT NULL,
  `semestre` varchar(10) NOT NULL,
  `ntn_compravendita` decimal(10,3) DEFAULT NULL,
  `ntn_locazione` decimal(10,3) DEFAULT NULL,
  `data_import` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ntn` (`zona_codice`,`descrizione_tipologia`,`anno`,`semestre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `omi_valori`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `omi_valori` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zona_codice` varchar(20) DEFAULT NULL,
  `fascia` varchar(10) DEFAULT NULL,
  `tipologia` varchar(10) DEFAULT NULL,
  `descrizione_tipologia` varchar(255) DEFAULT NULL,
  `stato` varchar(20) DEFAULT NULL,
  `compr_min` decimal(10,2) DEFAULT NULL,
  `compr_max` decimal(10,2) DEFAULT NULL,
  `loc_min` decimal(10,2) DEFAULT NULL,
  `loc_max` decimal(10,2) DEFAULT NULL,
  `superficie` varchar(5) DEFAULT NULL,
  `semestre` varchar(10) DEFAULT NULL,
  `anno` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_valore` (`zona_codice`,`descrizione_tipologia`(100),`stato`,`anno`,`semestre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `omi_zone`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `omi_zone` (
  `id` int NOT NULL AUTO_INCREMENT,
  `comune_istat` varchar(20) DEFAULT NULL,
  `comune` varchar(100) DEFAULT NULL,
  `fascia` varchar(10) DEFAULT NULL,
  `zona` varchar(10) DEFAULT NULL,
  `zona_codice` varchar(20) DEFAULT NULL,
  `descrizione_zona` varchar(255) DEFAULT NULL,
  `microzona` int DEFAULT NULL,
  `tipologia` varchar(10) DEFAULT NULL,
  `link_zona` varchar(20) DEFAULT NULL,
  `area` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_link_zona` (`link_zona`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `portafoglio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `portafoglio` (
  `id` int NOT NULL AUTO_INCREMENT,
  `valutazione_id` int DEFAULT NULL,
  `indirizzo` varchar(200) DEFAULT NULL,
  `zona_codice` varchar(20) DEFAULT NULL,
  `tipologia` varchar(100) DEFAULT NULL,
  `stato_immobile` varchar(20) DEFAULT NULL,
  `superficie_mq` decimal(8,2) DEFAULT NULL,
  `prezzo_acquisto` decimal(12,2) DEFAULT NULL,
  `canone_mensile` decimal(10,2) DEFAULT NULL,
  `vcm_valore_medio` decimal(12,2) DEFAULT NULL,
  `tir_pct` decimal(5,2) DEFAULT NULL,
  `roi_totale_pct` decimal(5,2) DEFAULT NULL,
  `van` decimal(12,2) DEFAULT NULL,
  `data_inserimento` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `note` text,
  `user_id` int DEFAULT NULL,
  `classe_energetica` varchar(20) DEFAULT NULL,
  `esposizione` varchar(20) DEFAULT NULL,
  `vista` varchar(20) DEFAULT NULL,
  `qualita_costruzione` varchar(20) DEFAULT NULL,
  `luminosita` varchar(20) DEFAULT NULL,
  `stato_conservazione` varchar(20) DEFAULT NULL,
  `fascia_omi` varchar(10) DEFAULT NULL,
  `tipo_valutazione` varchar(50) DEFAULT NULL,
  `vcm_valore_min` decimal(12,2) DEFAULT NULL,
  `vcm_valore_max` decimal(12,2) DEFAULT NULL,
  `vcm_prezzo_base_mq` decimal(10,2) DEFAULT NULL,
  `vcm_punti_alti` tinyint DEFAULT NULL,
  `red_valore_mercato` decimal(12,2) DEFAULT NULL,
  `red_noi_annuo` decimal(12,2) DEFAULT NULL,
  `red_rendimento_lordo_pct` decimal(5,2) DEFAULT NULL,
  `red_rendimento_netto_pct` decimal(5,2) DEFAULT NULL,
  `dcf_van` decimal(12,2) DEFAULT NULL,
  `dcf_tir_pct` decimal(5,2) DEFAULT NULL,
  `dcf_roi_totale_pct` decimal(5,2) DEFAULT NULL,
  `dcf_cash_on_cash_pct` decimal(5,2) DEFAULT NULL,
  `fonte_prezzo` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `valutazione_id` (`valutazione_id`),
  KEY `idx_pf_user` (`user_id`),
  CONSTRAINT `portafoglio_ibfk_1` FOREIGN KEY (`valutazione_id`) REFERENCES `valutazioni` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_rt_user` (`user_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `segnalazioni`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `segnalazioni` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `oggetto` varchar(200) DEFAULT NULL,
  `messaggio` text NOT NULL,
  `stato` enum('NUOVO','LETTO') DEFAULT 'NUOVO',
  `data_invio` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `segnalazioni_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `strade_cagliari`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `strade_cagliari` (
  `id` int NOT NULL AUTO_INCREMENT,
  `via` varchar(200) NOT NULL,
  `quartiere` varchar(100) NOT NULL,
  `link_zona` varchar(20) DEFAULT NULL,
  `top_cod` int DEFAULT NULL,
  `data_scraping` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_via` (`via`),
  KEY `idx_via_fulltext` (`via`),
  KEY `idx_quartiere` (`quartiere`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(30) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `ruolo` enum('admin','user') DEFAULT 'user',
  `ultimo_accesso` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `nome` varchar(100) DEFAULT NULL,
  `cognome` varchar(100) DEFAULT NULL,
  `stato` enum('pending','attivo','bloccato') DEFAULT 'pending',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `valutazioni`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `valutazioni` (
  `id` int NOT NULL AUTO_INCREMENT,
  `indirizzo` varchar(200) DEFAULT NULL,
  `zona_codice` varchar(20) DEFAULT NULL,
  `tipologia` varchar(100) DEFAULT NULL,
  `stato_immobile` varchar(20) DEFAULT NULL,
  `superficie_mq` decimal(8,2) DEFAULT NULL,
  `piano` int DEFAULT NULL,
  `anno_costruzione` int DEFAULT NULL,
  `ascensore` tinyint(1) DEFAULT '0',
  `box_auto` tinyint(1) DEFAULT '0',
  `balcone_terrazza` tinyint(1) DEFAULT '0',
  `cantina` tinyint(1) DEFAULT '0',
  `vcm_prezzo_base_mq` decimal(10,2) DEFAULT NULL,
  `vcm_coefficiente_stato` decimal(5,2) DEFAULT NULL,
  `vcm_coefficiente_piano` decimal(5,2) DEFAULT NULL,
  `vcm_valore_min` decimal(12,2) DEFAULT NULL,
  `vcm_valore_medio` decimal(12,2) DEFAULT NULL,
  `vcm_valore_max` decimal(12,2) DEFAULT NULL,
  `vcm_numero_comparabili` int DEFAULT '0',
  `red_canone_mensile_lordo` decimal(10,2) DEFAULT NULL,
  `red_noi_annuo` decimal(12,2) DEFAULT NULL,
  `red_spese_annue` decimal(10,2) DEFAULT NULL,
  `red_vacancy_pct` decimal(5,2) DEFAULT '5.00',
  `red_cap_rate_pct` decimal(5,2) DEFAULT NULL,
  `red_valore_mercato` decimal(12,2) DEFAULT NULL,
  `red_rendimento_lordo_pct` decimal(5,2) DEFAULT NULL,
  `red_rendimento_netto_pct` decimal(5,2) DEFAULT NULL,
  `dcf_prezzo_acquisto` decimal(12,2) DEFAULT NULL,
  `dcf_costi_acquisto_pct` decimal(5,2) DEFAULT '10.00',
  `dcf_costi_ristrutturazione` decimal(12,2) DEFAULT '0.00',
  `dcf_capitale_investito` decimal(12,2) DEFAULT NULL,
  `dcf_ltv_pct` decimal(5,2) DEFAULT '0.00',
  `dcf_tasso_mutuo_pct` decimal(5,2) DEFAULT '0.00',
  `dcf_durata_mutuo_anni` int DEFAULT '0',
  `dcf_rata_mensile` decimal(10,2) DEFAULT '0.00',
  `dcf_orizzonte_anni` int DEFAULT '5',
  `dcf_tasso_crescita_noi_pct` decimal(5,2) DEFAULT '2.00',
  `dcf_tasso_attualizzazione_pct` decimal(5,2) DEFAULT '6.00',
  `dcf_valore_rivendita_finale` decimal(12,2) DEFAULT NULL,
  `dcf_van` decimal(12,2) DEFAULT NULL,
  `dcf_tir_pct` decimal(5,2) DEFAULT NULL,
  `dcf_roi_totale_pct` decimal(5,2) DEFAULT NULL,
  `dcf_cash_on_cash_pct` decimal(5,2) DEFAULT NULL,
  `metodologia_principale` varchar(50) DEFAULT NULL,
  `data_valutazione` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `note` text,
  `salvato_portafoglio` tinyint(1) DEFAULT '0',
  `user_id` int DEFAULT NULL,
  `classe_energetica` varchar(20) DEFAULT NULL,
  `esposizione` varchar(20) DEFAULT NULL,
  `vista` varchar(20) DEFAULT NULL,
  `qualita_costruzione` varchar(20) DEFAULT NULL,
  `luminosita` varchar(20) DEFAULT NULL,
  `stato_conservazione` varchar(20) DEFAULT NULL,
  `vcm_fascia_omi` varchar(10) DEFAULT NULL,
  `vcm_punti_alti` tinyint DEFAULT NULL,
  `tipo_valutazione` varchar(50) DEFAULT NULL,
  `prezzo_dichiarato` decimal(12,2) DEFAULT NULL,
  `fonte_prezzo` varchar(50) DEFAULT NULL,
  `note_prezzo` text,
  `num_locali` int DEFAULT NULL,
  `num_bagni` int DEFAULT NULL,
  `url_annuncio` varchar(500) DEFAULT NULL,
  `has_abusi` tinyint(1) DEFAULT NULL,
  `descrizione_abusi` text,
  PRIMARY KEY (`id`),
  KEY `idx_val_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

