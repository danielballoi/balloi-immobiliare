/**
 * @file useStatistiche.js
 * @description Custom hook React per caricare statistiche e trend di un quartiere.
 *   Usato da StatisticheQuartiere.jsx per separare il data-fetching dalla UI.
 *
 *   Carica in parallelo:
 *   - Statistiche prezzi per tipologia/stato (anno più recente)
 *   - Trend storico annuale (2020–oggi)
 *
 *   Come si usa:
 *   ```js
 *   const { statistiche, trend, loading, errore } = useStatistiche('MARINA - STAMPACE');
 *   ```
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

import { useState, useEffect } from 'react';
import { getStatisticheZona, getTrendZona } from '../services/api';

/**
 * Hook per caricare statistiche + trend di un quartiere.
 *
 * @param {string} nomeZona  - Nome del quartiere (es. 'MARINA - STAMPACE')
 * @param {string} [comune]  - Comune (default 'Cagliari')
 * @returns {{
 *   statistiche: Array,
 *   trend: Array,
 *   loading: boolean,
 *   errore: string|null
 * }}
 */
function useStatistiche(nomeZona, comune = 'Cagliari') {
  const [statistiche, setStatistiche] = useState([]);
  const [trend, setTrend]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [errore, setErrore]           = useState(null);

  useEffect(() => {
    // Non caricare se non è stato selezionato un quartiere
    if (!nomeZona) {
      setStatistiche([]);
      setTrend([]);
      return;
    }

    console.log(`[HOOK-STATISTICHE] Caricamento dati per: ${nomeZona}`);
    setLoading(true);
    setErrore(null);

    // Carica statistiche e trend in parallelo per velocizzare il caricamento
    Promise.all([
      // Parametro nome per aggregare tutte le sottozone con lo stesso nome
      getStatisticheZona('_', { nome: nomeZona, comune }),
      getTrendZona('_',      { nome: nomeZona, stato: 'NORMALE', comune }),
    ])
      .then(([stats, trendData]) => {
        console.log(`[HOOK-STATISTICHE] Stats: ${stats.length} righe, Trend: ${trendData.length} anni`);
        setStatistiche(stats);

        // Formatta il trend per Recharts: arrotonda i valori per la visualizzazione
        setTrend(trendData.map(r => ({
          ...r,
          anno:               r.anno,
          prezzo_medio_mq:    Math.round(r.prezzo_medio_mq    || 0),
          locazione_media_mq: Math.round(r.locazione_media_mq || 0),
        })));
      })
      .catch(err => {
        console.error('[HOOK-STATISTICHE] Errore:', err);
        setErrore('Impossibile caricare le statistiche del quartiere.');
      })
      .finally(() => setLoading(false));
  }, [nomeZona, comune]); // Ri-carica quando cambia il quartiere

  return { statistiche, trend, loading, errore };
}

export default useStatistiche;
