/**
 * @file valutazioniController.js
 * @description Controller per le valutazioni immobiliari.
 *   Ruolo: legge dati dalla request, chiama i services di calcolo (VCM/Reddituale/DCF)
 *   e il model Valutazioni per la persistenza, risponde in JSON.
 *
 *   I services di calcolo restano in backend/services/ — sono funzioni matematiche
 *   pure che non dipendono da HTTP o DB. Il controller li chiama direttamente.
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

const { calcolaVCM }        = require('../services/valutazioneComparativa');
const { calcolaReddituale } = require('../services/valutazioneReddituale');
const { calcolaDCF }        = require('../services/valutazioneFinanziaria');
const ValutazioniModel      = require('../models/Valutazioni');

/**
 * POST /api/valutazioni/calcola-vcm
 * Calcola la valutazione comparativa di mercato (VCM).
 * Metodo: confronta i prezzi OMI per zona/tipologia/stato e applica
 * coefficienti per piano, dotazioni (ascensore, box, ecc.).
 */
async function calcolaVCMHandler(req, res, next) {
  try {
    const {
      zona_codice, tipologia, stato, superficie_mq,
      piano = 1, ascensore = false, box_auto = false,
      balcone_terrazza = false, cantina = false,
      giardino = false, prezzo_base_override = null,
    } = req.body;

    if (!zona_codice || !tipologia || !stato || !superficie_mq) {
      return res.status(400).json({ error: 'Campi obbligatori: zona_codice, tipologia, stato, superficie_mq' });
    }

    console.log(`[CTRL-VALUTAZIONI] calcolaVCM: ${tipologia} in ${zona_codice}`);
    const result = await calcolaVCM({
      zona_codice, tipologia, stato,
      superficie_mq:          parseFloat(superficie_mq),
      piano:                  parseInt(piano),
      ascensore:              Boolean(ascensore),
      box_auto:               Boolean(box_auto),
      balcone_terrazza:       Boolean(balcone_terrazza),
      cantina:                Boolean(cantina),
      giardino:               Boolean(giardino),
      prezzo_base_override:   prezzo_base_override ? parseFloat(prezzo_base_override) : null,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/valutazioni/calcola-reddituale
 * Calcola la valutazione reddituale (income approach).
 * Metodo: capitalizzazione del reddito netto operativo (NOI / cap rate).
 */
async function calcolaRedditualeHandler(req, res, next) {
  try {
    const {
      superficie_mq, canone_mensile, vacancy_pct = 5,
      spese_annue = 0, cap_rate_pct,
    } = req.body;

    if (!canone_mensile || !cap_rate_pct) {
      return res.status(400).json({ error: 'Campi obbligatori: canone_mensile, cap_rate_pct' });
    }

    const result = calcolaReddituale({
      superficie_mq:  parseFloat(superficie_mq || 0),
      canone_mensile: parseFloat(canone_mensile),
      vacancy_pct:    parseFloat(vacancy_pct),
      spese_annue:    parseFloat(spese_annue),
      cap_rate_pct:   parseFloat(cap_rate_pct),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/valutazioni/calcola-dcf
 * Calcola l'analisi DCF (Discounted Cash Flow).
 * Metodo: attualizza i flussi di cassa futuri e il valore di rivendita finale.
 */
async function calcolaDCFHandler(req, res, next) {
  try {
    const {
      prezzo_acquisto, costi_acquisto_pct = 10,
      costi_ristrutturazione = 0, ltv_pct = 0,
      tasso_mutuo_pct = 0, durata_mutuo_anni = 20,
      canone_mensile, vacancy_pct = 5,
      spese_operative_annue = 0, tasso_crescita_noi_pct = 2,
      orizzonte_anni = 5, tasso_attualizzazione_pct = 6,
      metodo_exit = 'reddituale', cap_rate_exit_pct = 5,
      tasso_crescita_valore_pct = 2, capex_straordinari = [],
    } = req.body;

    if (!prezzo_acquisto || !canone_mensile) {
      return res.status(400).json({ error: 'Campi obbligatori: prezzo_acquisto, canone_mensile' });
    }

    const result = calcolaDCF({
      prezzo_acquisto:           parseFloat(prezzo_acquisto),
      costi_acquisto_pct:        parseFloat(costi_acquisto_pct),
      costi_ristrutturazione:    parseFloat(costi_ristrutturazione),
      ltv_pct:                   parseFloat(ltv_pct),
      tasso_mutuo_pct:           parseFloat(tasso_mutuo_pct),
      durata_mutuo_anni:         parseInt(durata_mutuo_anni),
      canone_mensile:            parseFloat(canone_mensile),
      vacancy_pct:               parseFloat(vacancy_pct),
      spese_operative_annue:     parseFloat(spese_operative_annue),
      tasso_crescita_noi_pct:    parseFloat(tasso_crescita_noi_pct),
      orizzonte_anni:            parseInt(orizzonte_anni),
      tasso_attualizzazione_pct: parseFloat(tasso_attualizzazione_pct),
      metodo_exit,
      cap_rate_exit_pct:         parseFloat(cap_rate_exit_pct),
      tasso_crescita_valore_pct: parseFloat(tasso_crescita_valore_pct),
      capex_straordinari,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/valutazioni/salva
 * Salva una valutazione completa nel database.
 */
async function salva(req, res, next) {
  try {
    console.log('[CTRL-VALUTAZIONI] salva valutazione');
    const id = await ValutazioniModel.salvaValutazione(req.body);
    res.json({ success: true, valutazione_id: id });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valutazioni
 * Lista valutazioni salvate con paginazione.
 */
async function lista(req, res, next) {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const rows = await ValutazioniModel.getValutazioni(parseInt(limit), parseInt(offset));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/valutazioni/:id
 * Dettaglio completo di una valutazione.
 */
async function dettaglio(req, res, next) {
  try {
    const val = await ValutazioniModel.getValutazioneById(req.params.id);
    if (!val) return res.status(404).json({ error: 'Valutazione non trovata' });
    res.json(val);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/valutazioni/:id
 * Elimina una valutazione.
 */
async function elimina(req, res, next) {
  try {
    await ValutazioniModel.deleteValutazione(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  calcolaVCMHandler,
  calcolaRedditualeHandler,
  calcolaDCFHandler,
  salva,
  lista,
  dettaglio,
  elimina,
};
