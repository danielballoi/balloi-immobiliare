/**
 * ComuniSearch — Autocomplete per i comuni dell'Hinterland di Cagliari.
 *
 * A differenza di StradeAutocomplete (che chiama il backend), questo componente
 * lavora solo con dati locali: riceve la lista `zone` già caricata in memoria
 * ed estrae i comuni distinti. Nessuna chiamata API.
 *
 * Prop:
 *   zone         (required) - array zone OMI già caricato (ogni zona ha .comune)
 *   onSeleziona  (required) - callback con { comune } quando l'utente sceglie
 *   placeholder  (optional)
 */

import { useState, useEffect, useRef, useMemo } from 'react';

export default function ComuniSearch({ zone = [], onSeleziona, placeholder = 'Cerca un comune…' }) {
  const [query,       setQuery]       = useState('');
  const [aperto,      setAperto]      = useState(false);
  const [indiceFocus, setIndiceFocus] = useState(-1);

  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);

  // Estrae i comuni distinti dall'array zone e li ordina alfabeticamente
  // useMemo evita di ricalcolare ad ogni render
  const tuttiComuni = useMemo(() => {
    const set = new Set(zone.map(z => z.comune).filter(Boolean));
    return [...set].sort();
  }, [zone]);

  // Filtra i comuni in base alla query (case-insensitive)
  const comuniFiltrati = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return tuttiComuni;
    return tuttiComuni.filter(c => c.toUpperCase().includes(q));
  }, [tuttiComuni, query]);

  // Chiude il dropdown cliccando fuori
  useEffect(() => {
    function handleClickFuori(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current   && !inputRef.current.contains(e.target)
      ) {
        setAperto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFuori);
    return () => document.removeEventListener('mousedown', handleClickFuori);
  }, []);

  // Gestione tastiera
  function handleKeyDown(e) {
    if (!aperto || comuniFiltrati.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceFocus(i => Math.min(i + 1, comuniFiltrati.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceFocus(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && indiceFocus >= 0) {
      e.preventDefault();
      seleziona(comuniFiltrati[indiceFocus]);
    } else if (e.key === 'Escape') {
      setAperto(false);
    }
  }

  function seleziona(comune) {
    console.log(`[ComuniSearch] Selezionato: ${comune}`);
    setQuery(comune);
    setAperto(false);
    onSeleziona({ comune });
  }

  function svuota() {
    setQuery('');
    setAperto(false);
    inputRef.current?.focus();
    onSeleziona(null);
  }

  return (
    <div className="relative">

      {/* Input */}
      <div
        className="flex items-center rounded-xl"
        style={{
          background:     'rgba(15,17,23,0.65)',
          backdropFilter: 'blur(12px)',
          border:         '1px solid rgba(255,255,255,0.20)',
        }}
      >
        {/* Icona lente */}
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"
          className="ml-4 w-4 h-4 shrink-0 pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.45)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setAperto(true); setIndiceFocus(-1); }}
          onFocus={() => setAperto(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 px-3 py-3 text-sm placeholder:text-white/40 bg-transparent"
          style={{ color: '#fff', outline: 'none' }}
        />

        {query && (
          <button
            onClick={svuota}
            className="mr-3 w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none"
            style={{ background: 'rgba(255,255,255,0.20)', color: '#fff' }}
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {aperto && comuniFiltrati.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-auto z-50 shadow-2xl"
          style={{
            background: 'var(--bg-card)',
            border:     '1px solid var(--border)',
            maxHeight:  '240px',
          }}
        >
          {comuniFiltrati.map((comune, idx) => (
            <button
              key={comune}
              onMouseDown={(e) => { e.preventDefault(); seleziona(comune); }}
              onMouseEnter={() => setIndiceFocus(idx)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm"
              style={{
                background:   idx === indiceFocus ? 'rgba(255,255,255,0.06)' : 'transparent',
                borderBottom: idx < comuniFiltrati.length - 1 ? '1px solid var(--border)' : 'none',
                color:        'var(--text-primary)',
              }}
            >
              {/* Nome comune con highlight */}
              <span className="font-medium">
                <HighlightMatch testo={comune} query={query} />
              </span>
              {/* Badge "Provincia di Cagliari" */}
              <span
                className="ml-3 px-2 py-0.5 rounded text-xs shrink-0"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
              >
                Provincia CA
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Evidenzia la parte del comune che corrisponde alla query */
function HighlightMatch({ testo, query }) {
  if (!query || !testo) return <>{testo}</>;
  const idx = testo.toUpperCase().indexOf(query.toUpperCase());
  if (idx < 0) return <>{testo}</>;
  return (
    <>
      {testo.substring(0, idx)}
      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
        {testo.substring(idx, idx + query.length)}
      </span>
      {testo.substring(idx + query.length)}
    </>
  );
}
