/**
 * @file useTipologia.js
 * @description Custom hook React per caricare i dati storici annuali
 *   di una specifica tipologia immobiliare in un quartiere.
 *   Usato da DettaglioTipologia.jsx.
 *
 *   Carica in parallelo:
 *   - Prezzi storici per anno (tipologia-annuale)
 *   - Volumi NTN per anno (numero transazioni)
 *
 *   Come si usa:
 *   ```js
 *   const { dati, ntn, loading, errore } = useTipologia(
 *     'MARINA - STAMPACE',
 *     'Abitazioni civili',
 *     'NORMALE'
 *   );
 *   ```
 *
 * @author Balloi Immobiliare Dev
 * @date 2025-01-01
 */

import { useState, useEffect } from 'react';
import { getTipologiaAnnuale, getNTNZona } from '../services/api';

/**
 * Hook per caricare il dettaglio storico di una tipologia immobiliare.
 *
 * @param {string} nome   - Nome del quartiere
 * @param {string} tipo   - Tipologia immobile (es. 'Abitazioni civili')
 * @param {string} stato  - Stato conservativo (es. 'NORMALE')
 * @returns {{
 *   dati: Array,
 *   ntn: Object,
 *   loading: boolean,
 *   errore: string|null
 * }}
 */
function useTipologia(nome, tipo, stato = 'NORMALE') {
  const [dati, setDati]       = useState([]);
  const [ntn, setNtn]         = useState({});  // Mappa { anno: { ntn_compravendita, ntn_locazione } }
  const [loading, setLoading] = useState(false);
  const [errore, setErrore]   = useState(null);

  useEffect(() => {
    // Non caricare se mancano parametri obbligatori
    if (!nome || !tipo) return;

    console.log(`[HOOK-TIPOLOGIA] Caricamento: ${tipo} in ${nome} (${stato})`);
    setLoading(true);
    setErrore(null);

    // Carica prezzi storici e volumi NTN in parallelo
    Promise.all([
      getTipologiaAnnuale({ nome, tipo, stato }),
      getNTNZona(nome, tipo),
    ])
      .then(([rows, ntnRows]) => {
        console.log(`[HOOK-TIPOLOGIA] Prezzi: ${rows.length} anni, NTN: ${ntnRows.length} anni`);

        // Formatta i dati prezzi per il grafico
        setDati(rows.map(r => ({
          ...r,
          prezzo_medio_mq:    Math.round(r.prezzo_medio_mq    || 0),
          prezzo_min:         Math.round(r.prezzo_min          || 0),
          prezzo_max:         Math.round(r.prezzo_max          || 0),
          // toFixed(1) per mostrare un decimale nella locazione
          locazione_media_mq: parseFloat(r.locazione_media_mq || 0).toFixed(1),
        })));

        // Converte l'array NTN in una mappa { anno → dati } per lookup O(1)
        const ntnMap = {};
        ntnRows.forEach(r => { ntnMap[r.anno] = r; });
        setNtn(ntnMap);
      })
      .catch(err => {
        console.error('[HOOK-TIPOLOGIA] Errore:', err);
        setErrore('Impossibile caricare i dati storici.');
      })
      .finally(() => setLoading(false));
  }, [nome, tipo, stato]); // Ri-carica quando cambiano i parametri

  return { dati, ntn, loading, errore };
}

export default useTipologia;
