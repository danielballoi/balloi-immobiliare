/**
 * StradeAutocomplete — Barra di ricerca con autocomplete per le vie di Cagliari.
 *
 * Funzionamento:
 *   1. L'utente digita il nome di una via (min 2 caratteri)
 *   2. Dopo 300ms di pausa (debounce) parte la chiamata API al backend
 *   3. Si apre un dropdown con max 15 suggerimenti (via + quartiere)
 *   4. L'utente clicca un suggerimento → si chiude il dropdown e viene
 *      chiamata la prop onSeleziona con { via, quartiere, link_zona }
 *
 * Prop:
 *   onSeleziona  (required) - callback chiamata quando l'utente sceglie una via
 *   placeholder  (optional) - testo placeholder dell'input
 *   className    (optional) - classi CSS aggiuntive per il wrapper
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchStrade } from '../services/api';

/**
 * compact=true → stile input normale (per wizard form)
 * compact=false (default) → stile glassmorphism (per hero image)
 */
export default function StradeAutocomplete({ onSeleziona, onSvuota, placeholder = 'Cerca via…', className = '', compact = false }) {
  const [query,     setQuery]     = useState('');
  const [risultati, setRisultati] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [aperto,    setAperto]    = useState(false);
  const [indiceFocus, setIndiceFocus] = useState(-1); // per navigazione tastiera

  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);
  // Ref per il timer del debounce — lo cancelliamo se l'utente digita ancora
  const debounceRef = useRef(null);

  // ── Debounced search ────────────────────────────────────────────────────────
  // Ogni volta che cambia query, aspetto 300ms prima di chiamare l'API.
  // Se l'utente digita un altro carattere prima dei 300ms, azzero il timer.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setRisultati([]);
      setAperto(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchStrade(query.trim());
        setRisultati(data);
        setAperto(data.length > 0);
        setIndiceFocus(-1);
        console.log(`[StradeAutocomplete] ${data.length} risultati per "${query}"`);
      } catch (err) {
        console.error('[StradeAutocomplete] Errore ricerca:', err.message);
        setRisultati([]);
        setAperto(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    // Cleanup: cancella il timer se il componente viene smontato
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ── Chiude il dropdown cliccando fuori ─────────────────────────────────────
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

  // ── Selezione di un risultato ───────────────────────────────────────────────
  const seleziona = useCallback((item) => {
    console.log(`[StradeAutocomplete] Selezionato: ${item.via} → ${item.quartiere}`);
    setQuery(item.via);   // popola l'input con la via scelta
    setAperto(false);
    setRisultati([]);
    onSeleziona(item);    // notifica il parent
  }, [onSeleziona]);

  // ── Navigazione tastiera (frecce + Invio + Escape) ──────────────────────────
  function handleKeyDown(e) {
    if (!aperto || risultati.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceFocus(i => Math.min(i + 1, risultati.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceFocus(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && indiceFocus >= 0) {
      e.preventDefault();
      seleziona(risultati[indiceFocus]);
    } else if (e.key === 'Escape') {
      setAperto(false);
    }
  }

  // ── Svuota la ricerca ───────────────────────────────────────────────────────
  function svuota() {
    setQuery('');
    setRisultati([]);
    setAperto(false);
    inputRef.current?.focus();
    // Notifica il parent così può resettare eventuali filtri derivati
    onSvuota?.();
  }

  return (
    <div className={`relative ${className}`}>

      {/* Input di ricerca — stile diverso a seconda di compact */}
      <div
        className="flex items-center rounded-xl"
        style={compact ? {
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
        } : {
          background:     'rgba(15,17,23,0.70)',
          backdropFilter: 'blur(12px)',
          border:         '1px solid rgba(255,255,255,0.25)',
        }}
      >
        <div className="ml-4 w-5 h-5 shrink-0 flex items-center justify-center">
          {loading ? (
            <div
              className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={compact
                ? { borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }
                : { borderColor: 'rgba(255,255,255,0.45)', borderTopColor: 'transparent' }
              }
            />
          ) : (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"
              className="w-4 h-4"
              style={{ color: compact ? 'var(--text-muted)' : 'rgba(255,255,255,0.45)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L22 21m-4.343-4.343A8 8 0 1 0 5.686 5.686a8 8 0 0 0 11.971 10.971z" />
            </svg>
          )}
        </div>

        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => risultati.length > 0 && setAperto(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`flex-1 bg-transparent ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-4 text-base'}`}
          style={compact
            ? { color: 'var(--text-primary)', outline: 'none' }
            : { color: '#fff', outline: 'none' }
          }
        />

        {query && (
          <button
            onClick={svuota}
            className="mr-3 w-5 h-5 rounded-full flex items-center justify-center text-xs leading-none"
            style={compact
              ? { background: 'var(--bg-hover)', color: 'var(--text-muted)' }
              : { background: 'rgba(255,255,255,0.20)', color: '#fff' }
            }
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown suggerimenti */}
      {aperto && risultati.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {risultati.map((item, idx) => (
            <button
              key={item.via}
              onMouseDown={(e) => {
                e.preventDefault();
                seleziona(item);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 20px',
                textAlign: 'left',
                fontSize: 14,
                cursor: 'pointer',
                border: 'none',
                borderBottom: idx < risultati.length - 1 ? '1px solid var(--border)' : 'none',
                background: idx === indiceFocus ? 'var(--bg-hover)' : 'transparent',
                color: 'var(--text-primary)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setIndiceFocus(idx)}
            >
              {/* Via */}
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                <HighlightMatch testo={formatVia(item.via)} query={query} />
              </span>

              {/* Zona / quartiere */}
              <span
                style={{
                  marginLeft: 12,
                  marginRight: 4,
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  flexShrink: 0,
                  background: 'rgba(99,179,237,0.15)',
                  color: '#63b3ed',
                }}
              >
                {item.zona_nome || item.quartiere}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Converte il formato invertito del DB in formato leggibile.
 * Il DB usa: "LIBELLULE (DELLE)" → mostriamo: "DELLE LIBELLULE"
 * Il DB usa: "ABBAZIA (DELL')"   → mostriamo: "DELL'ABBAZIA"
 * Se non c'è parentesi, restituisce il testo invariato.
 *
 * @param {string} via - nome via nel formato DB (es. "LIBELLULE (DELLE)")
 * @returns {string} formato leggibile (es. "DELLE LIBELLULE")
 */
function formatVia(via) {
  if (!via) return via;
  // Pattern: "PAROLA (ARTICOLO)" o "PAROLE MULTIPLE (ARTICOLO)"
  const match = via.match(/^(.+?)\s+\(([^)]+)\)(.*)$/);
  if (!match) return via;
  const [, nome, articolo, resto] = match;
  // Ricostruisce: ARTICOLO + spazio (o niente per DELL') + NOME
  const sep = articolo.endsWith("'") ? '' : ' ';
  return `${articolo}${sep}${nome}${resto}`.trim();
}

/**
 * Componente di supporto: evidenzia la parte del testo che corrisponde alla query.
 * Es: query="LIBELLULE" + testo="DELLE LIBELLULE" → DELLE <b>LIBELLULE</b>
 */
function HighlightMatch({ testo, query }) {
  if (!query || !testo) return <>{testo}</>;

  // Normalizza la query per il match: rimuove prefissi e articoli come nel backend
  const prefissi = ['VIALE ', 'VIA ', 'PIAZZA ', 'CORSO ', 'LARGO '];
  const articoli = ["DELL'", 'DELLE ', 'DEGLI ', 'DEI ', 'DEL ', 'DELLA '];
  let qNorm = query.toUpperCase().trim();
  for (const p of prefissi) { if (qNorm.startsWith(p)) { qNorm = qNorm.slice(p.length).trim(); break; } }
  for (const a of articoli) { if (qNorm.startsWith(a)) { qNorm = qNorm.slice(a.length).trim(); break; } }

  const idx = testo.toUpperCase().indexOf(qNorm);
  if (idx < 0) return <>{testo}</>;

  return (
    <>
      {testo.substring(0, idx)}
      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
        {testo.substring(idx, idx + qNorm.length)}
      </span>
      {testo.substring(idx + qNorm.length)}
    </>
  );
}
