/**
 * Lista completa delle tipologie immobiliari con categoria catastale.
 * Fonte: DPR 1142/1949 — classificazione catastale italiana.
 *
 * Usato in: WizardValutazione (dropdown), DashboardMappa (filtro), MieiInvestimenti (form)
 */

export const TIPOLOGIE_CATASTALI = [
  // ── Residenziale ────────────────────────────────────────────────────────
  { nome: 'Abitazione signorile',          catastale: 'A/1',  gruppo: 'Residenziale' },
  { nome: 'Abitazione civile',             catastale: 'A/2',  gruppo: 'Residenziale' },
  { nome: 'Abitazione economica',          catastale: 'A/3',  gruppo: 'Residenziale' },
  { nome: 'Abitazione popolare',           catastale: 'A/4',  gruppo: 'Residenziale' },
  { nome: 'Abitazione ultrapopolare',      catastale: 'A/5',  gruppo: 'Residenziale' },
  { nome: 'Abitazione rurale',             catastale: 'A/6',  gruppo: 'Residenziale' },
  { nome: 'Villini',                       catastale: 'A/7',  gruppo: 'Residenziale' },
  { nome: 'Ville',                         catastale: 'A/8',  gruppo: 'Residenziale' },
  { nome: 'Castelli e palazzi di pregio',  catastale: 'A/9',  gruppo: 'Residenziale' },
  { nome: 'Uffici e studi privati',        catastale: 'A/10', gruppo: 'Residenziale' },
  { nome: 'Abitazioni tipiche',            catastale: 'A/11', gruppo: 'Residenziale' },

  // ── Commerciale / Terziario ─────────────────────────────────────────────
  { nome: 'Negozi e botteghe',                        catastale: 'C/1', gruppo: 'Commerciale / Terziario' },
  { nome: 'Magazzini e locali di deposito',           catastale: 'C/2', gruppo: 'Commerciale / Terziario' },
  { nome: 'Laboratori arti e mestieri',               catastale: 'C/3', gruppo: 'Commerciale / Terziario' },
  { nome: 'Fabbricati e locali per esercizi sportivi',catastale: 'C/4', gruppo: 'Commerciale / Terziario' },
  { nome: 'Stabilimenti balneari',                    catastale: 'C/5', gruppo: 'Commerciale / Terziario' },
  { nome: 'Autorimesse e posti auto',                 catastale: 'C/6', gruppo: 'Commerciale / Terziario' },
  { nome: 'Tettoie chiuse o aperte',                  catastale: 'C/7', gruppo: 'Commerciale / Terziario' },

  // ── Altro ───────────────────────────────────────────────────────────────
  { nome: 'Opifici',                  catastale: 'D/1', gruppo: 'Altro' },
  { nome: 'Alberghi e pensioni',      catastale: 'D/2', gruppo: 'Altro' },
  { nome: 'Teatri e cinema',          catastale: 'D/3', gruppo: 'Altro' },
  { nome: 'Case di cura e ospedali',  catastale: 'D/4', gruppo: 'Altro' },
  { nome: 'Istituti di credito',      catastale: 'D/5', gruppo: 'Altro' },
  { nome: 'Fabbricati industriali',   catastale: 'D/7', gruppo: 'Altro' },
  { nome: 'Fabbricati commerciali',   catastale: 'D/8', gruppo: 'Altro' },
];

/**
 * Lookup: OMI descrizione_tipologia → codice catastale.
 * Usato in DashboardMappa per arricchire le tipologie caricate dal DB.
 */
export const CATASTALE_LOOKUP = {
  'Abitazioni signorili':                     'A/1',
  'Abitazioni civili':                        'A/2',
  "Abitazioni di tipo economico":             'A/3',
  'Abitazioni popolari':                      'A/4',
  'Abitazioni ultrapopolari':                 'A/5',
  'Abitazioni rurali':                        'A/6',
  'Villini':                                  'A/7',
  'Ville':                                    'A/8',
  'Castelli, palazzi di eminente pregio':     'A/9',
  'Uffici e studi privati':                   'A/10',
  "Abitazioni ed alloggi tipici dei luoghi":  'A/11',
  'Negozi e botteghe':                        'C/1',
  'Magazzini e locali di deposito':           'C/2',
  'Laboratori per arti e mestieri':           'C/3',
  'Fabbricati e locali per esercizi sportivi':'C/4',
  'Stabilimenti balneari e di acque curative':'C/5',
  'Stalle, scuderie, rimesse, autorimesse':   'C/6',
  'Tettoie chiuse od aperte':                 'C/7',
  'Opifici':                                  'D/1',
  'Alberghi e pensioni':                      'D/2',
  'Teatri, cinematografi, sale spettacoli':   'D/3',
  'Case di cura ed ospedali':                 'D/4',
  'Istituti di credito, cambio e assicurazione':'D/5',
  'Fabbricati industriali speciali':          'D/7',
  'Fabbricati commerciali speciali':          'D/8',
};

export const GRUPPI_TIPOLOGIE = ['Residenziale', 'Commerciale / Terziario', 'Altro'];
