-- Migration: aggiunge url_annuncio a censimenti_immobili
-- e num_locali, num_bagni, url_annuncio a valutazioni
-- Esegui una volta sola sul database.

ALTER TABLE censimenti_immobili
  ADD COLUMN IF NOT EXISTS url_annuncio VARCHAR(500);

ALTER TABLE valutazioni
  ADD COLUMN IF NOT EXISTS num_locali INT,
  ADD COLUMN IF NOT EXISTS num_bagni INT,
  ADD COLUMN IF NOT EXISTS url_annuncio VARCHAR(500);
