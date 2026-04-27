/**
 * Modulo API - Layer di comunicazione col backend
 *
 * Centralizza tutte le chiamate HTTP in un unico posto.
 * Vantaggi:
 *   - Se l'URL base cambia, la modifichi solo qui
 *   - Ogni componente importa solo le funzioni che gli servono
 *   - I log degli errori sono consistenti ovunque
 *
 * Axios è una libreria HTTP che semplifica fetch():
 *   - Converte automaticamente JSON in/out
 *   - Gestisce gli errori HTTP (4xx, 5xx) come eccezioni
 *   - Permette di configurare header globali (interceptors)
 */

import axios from 'axios';

// ── Istanza Axios configurata ──────────────────────────────────────────────
// withCredentials: true → invia i cookie httpOnly al backend (XSS-safe auth)
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Interceptor risposta: log errori + auto-refresh su 401 ───────────────
// Quando il token di accesso scade (15min) il backend risponde 401.
// L'interceptor chiama automaticamente /auth/refresh (che usa il cookie
// balloi_refresh a 30 giorni) e ripete la richiesta originale.
// Se anche il refresh fallisce → redirect a /login.

let refreshingToken = false;
let refreshQueue    = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url    = error.config?.url ?? 'unknown';
    const status = error.response?.status ?? 'network error';
    const msg    = error.response?.data?.error ?? error.message;
    console.error(`[API] Errore ${status} su ${url}: ${msg}`);

    const isAuthRoute    = url.includes('/auth/');
    const isRefreshRoute = url.includes('/auth/refresh');

    if (status === 401 && !isAuthRoute) {
      if (isRefreshRoute) {
        // Il refresh stesso è fallito → sessione terminata
        refreshQueue.forEach(({ reject }) => reject(error));
        refreshQueue = [];
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (!refreshingToken) {
        refreshingToken = true;
        try {
          await api.post('/auth/refresh');
          // Ripete tutte le richieste che erano in attesa
          const pending = [...refreshQueue];
          refreshQueue = [];
          pending.forEach(({ config, resolve, reject }) =>
            api(config).then(resolve).catch(reject)
          );
          return api(error.config);
        } catch {
          refreshQueue.forEach(({ reject }) => reject(error));
          refreshQueue = [];
          window.location.href = '/login';
          return Promise.reject(error);
        } finally {
          refreshingToken = false;
        }
      } else {
        // Altre richieste arrivate durante il refresh → le accodiamo
        return new Promise((resolve, reject) => {
          refreshQueue.push({ config: error.config, resolve, reject });
        });
      }
    }

    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// ZONE OMI
// ═══════════════════════════════════════════════════════════════════════════

/** Recupera tutte le zone del comune con prezzi medi */
export const getZone = (comune = 'Cagliari') =>
  api.get('/zone', { params: { comune } }).then(r => r.data);

/** Autocomplete zone per nome */
export const searchZone = (q, comune = 'Cagliari') =>
  api.get('/zone/search', { params: { q, comune } }).then(r => r.data);

/** Dati heatmap per la mappa — area: 'CAGLIARI' | 'HINTERLAND' | null (tutti) */
export const getHeatmap = (comune = 'Cagliari', area = null) => {
  const params = {};
  if (area)         params.area   = area;
  else if (comune)  params.comune = comune;
  // area=null + comune=null → nessun filtro → restituisce tutte le zone
  return api.get('/zone/heatmap', { params }).then(r => r.data);
};

/** Dettaglio singola zona per codice */
export const getZona = (codice) =>
  api.get(`/zone/${codice}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// VALORI OMI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dettaglio storico annuale per una specifica tipologia in un quartiere.
 * Params: { nome, tipo, stato } → restituisce un record per anno (2020-2025).
 */
export const getTipologiaAnnuale = (params = {}) =>
  api.get('/valori/tipologia-annuale', { params }).then(r => r.data);

/** Lista valori con filtri opzionali */
export const getValori = (params = {}) =>
  api.get('/valori', { params }).then(r => r.data);

/** Lista tipologie immobili distinte */
export const getTipologie = () =>
  api.get('/valori/tipologie').then(r => r.data);

/** Anni/semestri disponibili nel DB */
export const getAnni = () =>
  api.get('/valori/anni').then(r => r.data);

/**
 * Statistiche prezzi per zona (ripartite per tipologia e stato).
 * Passa { nome: 'NOME QUARTIERE' } in params per aggregare tutte le sottozone.
 */
export const getStatisticheZona = (zona, params = {}) =>
  api.get(`/valori/statistiche/${encodeURIComponent(zona)}`, { params }).then(r => r.data);

/**
 * Trend storico dei prezzi per zona.
 * Con { nome: 'NOME QUARTIERE' } il backend aggrega per anno (2020–2025).
 */
export const getTrendZona = (zona, params = {}) =>
  api.get(`/valori/trend/${encodeURIComponent(zona)}`, { params }).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// VALUTAZIONI - Calcoli
// ═══════════════════════════════════════════════════════════════════════════

/** Calcola valutazione comparativa di mercato (VCM) */
export const calcolaVCM = (dati) =>
  api.post('/valutazioni/calcola-vcm', dati).then(r => r.data);

/** Calcola valutazione reddituale */
export const calcolaReddituale = (dati) =>
  api.post('/valutazioni/calcola-reddituale', dati).then(r => r.data);

/** Calcola analisi DCF (Discounted Cash Flow) */
export const calcolaDCF = (dati) =>
  api.post('/valutazioni/calcola-dcf', dati).then(r => r.data);

/** Salva una valutazione completa nel DB */
export const salvaValutazione = (dati) =>
  api.post('/valutazioni/salva', dati).then(r => r.data);

/** Lista valutazioni salvate */
export const getValutazioni = (params = {}) =>
  api.get('/valutazioni', { params }).then(r => r.data);

/** Dettaglio valutazione singola */
export const getValutazione = (id) =>
  api.get(`/valutazioni/${id}`).then(r => r.data);

/** Elimina valutazione */
export const deleteValutazione = (id) =>
  api.delete(`/valutazioni/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// PORTAFOGLIO
// ═══════════════════════════════════════════════════════════════════════════

/** Lista immobili in portafoglio */
export const getPortafoglio = () =>
  api.get('/portafoglio').then(r => r.data);

/** KPI aggregati del portafoglio */
export const getSummaryPortafoglio = () =>
  api.get('/portafoglio/summary').then(r => r.data);

/** Aggiunge immobile al portafoglio */
export const aggiungiAPortafoglio = (dati) =>
  api.post('/portafoglio', dati).then(r => r.data);

/** Rimuove immobile dal portafoglio */
export const rimuoviDaPortafoglio = (id) =>
  api.delete(`/portafoglio/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT DATI
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upload CSV - usa FormData (non JSON) perché trasferisce un file binario.
 * Il Content-Type 'multipart/form-data' viene impostato automaticamente
 * da Axios quando vede un FormData.
 */
export const importCSV = (file, separatore = ';') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('separatore', separatore);
  return api.post('/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,  // 2 minuti per file grandi
  }).then(r => r.data);
};

/** Inserimento manuale singolo record */
export const insertManuale = (dati) =>
  api.post('/import/manuale', dati).then(r => r.data);

/** Log storico importazioni */
export const getImportLog = () =>
  api.get('/import/log').then(r => r.data);

/** Statistiche DB (quanti record, anni disponibili) */
export const getImportStats = () =>
  api.get('/import/stats').then(r => r.data);

/** Template colonne CSV attese */
export const getImportTemplate = () =>
  api.get('/import/template').then(r => r.data);

/** Import CSV con dati NTN (Numero Transazioni Normalizzate) */
export const importNTN = (file, separatore = ';') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('separatore', separatore);
  return api.post('/import/ntn', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);
};

// ═══════════════════════════════════════════════════════════════════════════
// NTN - NUMERO TRANSAZIONI NORMALIZZATE
// ═══════════════════════════════════════════════════════════════════════════

/** Volumi di mercato annuali per zona + tipologia */
export const getNTNZona = (nome, tipo) =>
  api.get('/ntn/zona', { params: { nome, tipo } }).then(r => r.data);

/** Statistiche NTN nel DB (totale record, anni) */
export const getNTNStats = () =>
  api.get('/ntn/stats').then(r => r.data);

/** Import bulk dalla cartella DATI_HINTERLAND sul server */
export const importCartella = () =>
  api.post('/import/cartella').then(r => r.data);

/**
 * Import ZONE.csv nel formato ufficiale OMI (Agenzia delle Entrate).
 * Anno e semestre vengono estratti dalla riga di metadati del file.
 * Righe di province diverse da CA vengono saltate e riportate nel risultato.
 */
export const importOMISemestraleZone = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/omi-semestrale-zone', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);
};

/**
 * Import VALORI.csv nel formato ufficiale OMI (Agenzia delle Entrate).
 * Anno e semestre vengono estratti dalla riga di metadati del file.
 */
export const importOMISemestraleValori = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/omi-semestrale-valori', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);
};

// ═══════════════════════════════════════════════════════════════════════════
// STRADE CAGLIARI — ricerca via → quartiere
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Autocomplete vie: cerca vie il cui nome contiene il testo dato.
 * Restituisce max 15 risultati con { via, quartiere, link_zona }.
 * Il backend richiede almeno 2 caratteri per rispondere.
 */
export const searchStrade = (q) =>
  api.get('/strade/search', { params: { q } }).then(r => r.data);

/**
 * Verifica se lo scraping è stato eseguito.
 * Restituisce { vie_totali, scraping_eseguito }.
 */
export const getStradeStats = () =>
  api.get('/strade/stats').then(r => r.data);

/** Lista di tutte le vie in un quartiere */
export const getVieByQuartiere = (nome) =>
  api.get(`/strade/quartiere/${encodeURIComponent(nome)}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// UTENZE — Gestione utenti (solo admin)
// ═══════════════════════════════════════════════════════════════════════════

/** Lista completa utenti con conteggi per stato */
export const getUtenze = () =>
  api.get('/utenze').then(r => r.data);

/** Approva un utente pending → attivo */
export const approvaUtente = (id) =>
  api.put(`/utenze/${id}/approva`).then(r => r.data);

/** Blocca un utente attivo */
export const bloccaUtente = (id) =>
  api.put(`/utenze/${id}/blocca`).then(r => r.data);

/** Riattiva un utente bloccato o pending */
export const riattivaUtente = (id) =>
  api.put(`/utenze/${id}/riattiva`).then(r => r.data);

/** Elimina un utente */
export const eliminaUtente = (id) =>
  api.delete(`/utenze/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// CENSIMENTI IMMOBILI
// ═══════════════════════════════════════════════════════════════════════════

export const getCensimenti           = ()           => api.get('/censimenti').then(r => r.data);
export const creaCensimento          = (dati)       => api.post('/censimenti', dati).then(r => r.data);
export const aggiornaCensimento      = (id, d)      => api.put(`/censimenti/${id}`, d).then(r => r.data);
export const eliminaCensimento       = (id)         => api.delete(`/censimenti/${id}`).then(r => r.data);
export const togglePreferitoImmobile = (id, val)   => api.patch(`/censimenti/${id}/preferito`, { preferito: val }).then(r => r.data);
export const cambiaStatoImmobile     = (id, stato) => api.patch(`/censimenti/${id}/stato`, { stato_interesse: stato }).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// LOCAZIONI ATTIVE
// ═══════════════════════════════════════════════════════════════════════════

export const getLocazioni      = ()       => api.get('/locazioni').then(r => r.data);
export const creaLocazione     = (dati)   => api.post('/locazioni', dati).then(r => r.data);
export const aggiornaLocazione = (id, d)  => api.put(`/locazioni/${id}`, d).then(r => r.data);
export const eliminaLocazione  = (id)     => api.delete(`/locazioni/${id}`).then(r => r.data);

// ═══════════════════════════════════════════════════════════════════════════
// SEGNALAZIONI
// ═══════════════════════════════════════════════════════════════════════════

/** Invia segnalazione all'admin */
export const inviaSegnalazione    = (dati) => api.post('/segnalazioni', dati).then(r => r.data);

/** Lista segnalazioni (solo admin) */
export const getSegnalazioni      = ()     => api.get('/segnalazioni').then(r => r.data);

/** Segna segnalazione come letta (solo admin) */
export const segnaLetta           = (id)   => api.put(`/segnalazioni/${id}/letto`).then(r => r.data);

export default api;


