/**
 * @file useHeatmap.js
 * @description Custom hook React per caricare le zone con prezzi per la Dashboard.
 *   Separa il data-fetching dalla UI: il componente DashboardMappa usa questo hook
 *   invece di fare fetch direttamente.
 *
 *   Cosa fa:
 *   1. Chiama GET /api/zone/heatmap con i parametri forniti
 *   2. Gestisce gli stati loading/errore
 *   3. Ri-carica automaticamente se cambiano comune o area
 *
 *   Come si usa nel componente:
 *   ```js
 *   const { zone, loading, errore } = useHeatmap('Cagliari', 'CAGLIARI');
 *   ```
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

import { useState, useEffect } from 'react';
import { getHeatmap } from '../services/api';

/**
 * Hook per caricare i dati heatmap della dashboard.
 *
 * @param {string} comune     - Comune da visualizzare (default 'Cagliari')
 * @param {string|null} area  - Filtro area: 'CAGLIARI' | 'HINTERLAND' | null (tutti)
 * @returns {{ zone: Array, loading: boolean, errore: string|null, ricarica: Function }}
 */
function useHeatmap(comune = 'Cagliari', area = null) {
  const [zone, setZone]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore]   = useState(null);

  // Funzione di caricamento — separata così possiamo esporla per "ricarica"
  const carica = () => {
    console.log(`[HOOK-HEATMAP] Caricamento: comune=${comune}, area=${area}`);
    setLoading(true);
    setErrore(null);

    getHeatmap(comune, area)
      .then(data => {
        console.log(`[HOOK-HEATMAP] Ricevuti ${data.length} zone`);
        setZone(data);
      })
      .catch(err => {
        console.error('[HOOK-HEATMAP] Errore caricamento:', err);
        setErrore('Impossibile caricare i dati. Verificare che il backend sia attivo sulla porta 5000.');
      })
      .finally(() => setLoading(false));
  };

  // Ri-carica automaticamente quando cambiano comune o area
  useEffect(() => {
    carica();
  }, [comune, area]); // eslint-disable-line react-hooks/exhaustive-deps

  return { zone, loading, errore, ricarica: carica };
}

export default useHeatmap;
