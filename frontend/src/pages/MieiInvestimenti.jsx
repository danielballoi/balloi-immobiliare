/**
 * MieiInvestimenti - Gestione portafoglio immobiliare personale
 *
 * Tre tab principali:
 *   - Immobili Censiti: card grid 3 per riga, ricerca su tutte le categorie,
 *                       sottotab ACQUISTATI / INTERESSATI / VENDUTI A TERZI
 *   - Locazioni:        tab ATTIVE (con azioni CHIUDI/RINNOVA/VENDITA) +
 *                       PASSATE (locazioni storiche), notifica contratti scaduti
 *   - Valutazioni Eseguite: dal Wizard
 *
 * Tutti i dati sono filtrati per userId autenticato (gestito dal backend).
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getPortafoglio, getSummaryPortafoglio, rimuoviDaPortafoglio,
  getCensimenti, creaCensimento, aggiornaCensimento, eliminaCensimento,
  togglePreferitoImmobile, cambiaStatoImmobile, aggiornaNoteImmobile,
  getLocazioni, creaLocazione, aggiornaLocazione, eliminaLocazione,
} from '../services/api';
import StatCard        from '../components/StatCard';
import LoadingSpinner  from '../components/LoadingSpinner';
import EmptyState      from '../components/EmptyState';
import CardValutazione from '../components/CardValutazione';
import { formatAddress } from '../utils/addressNormalizer';

// ── Formattatori ─────────────────────────────────────────────────────────────
const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–';
const formatPct = (n) =>
  n != null ? `${Number(n).toFixed(1)}%` : '–';
const formatMq = (n) =>
  n != null && n !== '' ? `${Math.round(Number(n))} mq` : null;
const formatData = (iso) =>
  iso ? new Date(iso).toLocaleDateString('it-IT') : '–';

// Data odierna in formato YYYY-MM-DD per confronti
const oggi = new Date().toISOString().split('T')[0];

// Note: formato JSON [{testo, data}] — compatibile con legacy string
function parseNote(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    return raw.trim() ? [{ testo: raw, data: null }] : [];
  } catch {
    return raw.trim() ? [{ testo: raw, data: null }] : [];
  }
}
function stringifyNote(arr) { return JSON.stringify(arr); }

/**
 * Normalizza un prezzo in formato italiano verso stringa numerica intera pulita.
 * "400.000" → "400000", "400.000,50" → "400000", "1.500.000" → "1500000"
 */
function parsePrezzo(val) {
  if (!val && val !== 0) return '';
  const s = String(val).trim();
  if (!s) return '';
  if (s.includes(',')) {
    return String(Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.'))));
  }
  const dots = (s.match(/\./g) || []).length;
  if (dots > 1) return s.replace(/\./g, '');
  if (dots === 1) {
    const after = s.split('.')[1];
    if (after && after.length === 3) return s.replace('.', '');
    return String(Math.round(parseFloat(s)));
  }
  return s.replace(/[^0-9]/g, '') || s;
}

// ── TAB SELECTOR ─────────────────────────────────────────────────────────────
function TabSelector({ attiva, onCambio }) {
  const tabs = [
    { id: 'tutti',       label: 'Tutti',               icon: '🏠' },
    { id: 'valutazioni', label: 'Valutazioni Eseguite', icon: '📊' },
    { id: 'locazioni',   label: 'Locazioni',            icon: '🔑' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-secondary)', overflowX: 'auto' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onCambio(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            whiteSpace: 'nowrap', transition: 'all 0.15s',
            background: attiva === t.id ? 'var(--accent)' : 'transparent',
            color: attiva === t.id ? '#000' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer',
          }}
        >
          <span>{t.icon}</span><span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── MODAL GENERICO ────────────────────────────────────────────────────────────
function Modal({ titolo, onChiudi, children }) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onChiudi} />
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <h2 className="modal-title">{titolo}</h2>
          <button className="modal-close" onClick={onChiudi}>×</button>
        </div>
        <div className="modal-body-col">
          {children}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl text-sm";
const inputStyle = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', padding: '12px 16px', outline: 'none',
};
const labelCls = "block text-sm font-semibold mb-2";
const labelStyle = { color: 'var(--text-muted)', letterSpacing: '0.01em' };

// ── MODAL CONFERMA (elimina / cambia stato / chiudi locazione ecc.) ──────────
function ModalConferma({ icona, titolo, messaggio, labelConferma, coloreConferma, onConferma, onAnnulla }) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onAnnulla} />
      <div className="modal-box modal-box-sm">
        <div className="modal-confirm-body">
          <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>{icona}</span>
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{titolo}</h3>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{messaggio}</p>
          <div className="flex gap-3 justify-center" style={{ marginTop: 8 }}>
            <button onClick={onAnnulla} className="btn-touch"
              style={{ padding: '10px 20px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={onConferma} className="btn-touch"
              style={{ padding: '10px 20px', borderRadius: 10, background: coloreConferma || 'var(--accent)', color: coloreConferma && coloreConferma !== 'var(--accent)' ? '#fff' : '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {labelConferma}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── POPUP SPOSTA — icona freccia con checklist per cambiare stato ────────────
function SpostaPopup({ imm, onCambia }) {
  const [aperto, setAperto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aperto) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setAperto(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aperto]);

  const opzioni = {
    COMPRATO:    [{ id: 'INTERESSATO', label: '◎ Sposta in Interessanti', color: '#fbbf24' }, { id: 'CEDUTO', label: '→ Sposta in Ceduti', color: '#f87171' }],
    INTERESSATO: [{ id: 'COMPRATO',   label: '✓ Sposta in Acquistati',   color: '#34d399' }, { id: 'CEDUTO', label: '→ Sposta in Ceduti', color: '#f87171' }],
    CEDUTO:      [{ id: 'INTERESSATO', label: '◎ Sposta in Interessanti', color: '#fbbf24' }, { id: 'COMPRATO', label: '✓ Sposta in Acquistati', color: '#34d399' }],
    VENDUTO_TERZI: [{ id: 'INTERESSATO', label: '◎ Sposta in Interessanti', color: '#fbbf24' }, { id: 'COMPRATO', label: '✓ Sposta in Acquistati', color: '#34d399' }],
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setAperto(v => !v); }}
        title="Sposta in un'altra categoria"
        style={{ height: 32, padding: '0 10px', borderRadius: 8, background: aperto ? 'rgba(245,158,11,0.15)' : 'var(--bg-secondary)', border: aperto ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: aperto ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}
      >
        <span>⇄</span>
      </button>
      {aperto && (
        <div
          style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: 6, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, boxShadow: '0 -4px 24px rgba(0,0,0,0.35)', minWidth: 220 }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sposta in</p>
          {(opzioni[imm.stato_interesse] || []).map(opt => (
            <button
              key={opt.id}
              onClick={e => { e.stopPropagation(); setAperto(false); onCambia(imm.id, imm.indirizzo, opt.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: opt.color, fontWeight: 600, textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── POPUP NOTE IMMOBILE ───────────────────────────────────────────────────────
function PopupNote({ imm, onAggiornaNote, onChiudi }) {
  const noteArr = parseNote(imm.note);
  const [nuovaNota, setNuovaNota] = useState('');
  const [salvando, setSalvando]   = useState(false);

  async function salva() {
    if (!nuovaNota.trim() || salvando) return;
    setSalvando(true);
    const entry = { testo: nuovaNota.trim(), data: new Date().toISOString() };
    try {
      await onAggiornaNote(imm.id, stringifyNote([entry, ...noteArr]));
      setNuovaNota('');
    } catch (err) {
      console.error('[NOTE] Errore salvataggio:', err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay modal-overlay-z60">
      <div className="modal-backdrop" onClick={onChiudi} />
      <div className="modal-box modal-box-sm" style={{ display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Informazioni</span>
              {noteArr.length > 0 && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: 'var(--accent)', fontWeight: 700 }}>{noteArr.length}</span>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatAddress(imm.indirizzo)}</p>
          </div>
          <button className="modal-close" onClick={onChiudi}>×</button>
        </div>

        {/* Lista note scrollabile — newest first */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {noteArr.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 28, marginBottom: 10 }}>📝</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Nessuna nota ancora.<br />Scrivi la prima qui sotto.</p>
            </div>
          ) : noteArr.map((n, i) => (
            <div key={i} style={{ padding: '14px 20px', borderBottom: i < noteArr.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
              {n.data && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                  {new Date(n.data).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.testo}</p>
            </div>
          ))}
        </div>

        {/* Footer — aggiungi nota */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <textarea
            value={nuovaNota}
            onChange={e => setNuovaNota(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) salva(); }}
            rows={3}
            placeholder="Scrivi una nuova nota… (Ctrl+Invio per salvare)"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
          />
          <button
            onClick={salva}
            disabled={!nuovaNota.trim() || salvando}
            className="btn-touch"
            style={{ alignSelf: 'flex-end', padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (!nuovaNota.trim() || salvando) ? 0.4 : 1 }}>
            {salvando ? 'Salvo…' : 'Aggiungi Nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL DETTAGLIO IMMOBILE ─────────────────────────────────────────────────
function DettaglioImmobile({ imm, onChiudi, onModifica, onAggiornaNote }) {
  const statoColore = { COMPRATO: '#34d399', INTERESSATO: '#fbbf24', CEDUTO: '#f87171', VENDUTO_TERZI: '#f87171' };
  const col = statoColore[imm.stato_interesse] || 'var(--text-muted)';
  const FASCIA_COLOR = { ALTA: 'var(--success)', MEDIA: 'var(--accent)', BASSA: 'var(--text-muted)' };
  const GIUDIZIO_COLOR = {
    'AFFARE': '#34d399', 'INTERESSANTE': '#a3e635', 'NELLA_MEDIA': '#fbbf24',
    'SOPRAVVALUTATO': '#fb923c', 'DA_EVITARE': '#f87171',
  };

  const [noteAperto, setNoteAperto] = useState(false);
  const [note, setNote]             = useState(() => parseNote(imm.note));
  const [nuovaNota, setNuovaNota]   = useState('');
  const [salvando, setSalvando]     = useState(false);

  const formattaData = (iso) => {
    if (!iso) return 'Data non disponibile';
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric'
    }) + ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const aggiungiNota = async () => {
    if (!nuovaNota.trim() || salvando) return;
    setSalvando(true);
    const nuovaVoce = { testo: nuovaNota.trim(), data: new Date().toISOString() };
    const noteAggiornate = [...note, nuovaVoce];
    try {
      await onAggiornaNote(imm.id, JSON.stringify(noteAggiornate));
      setNote(noteAggiornate);
      setNuovaNota('');
    } catch (err) {
      console.error('[NOTE] Errore salvataggio:', err);
    } finally {
      setSalvando(false);
    }
  };

  const sectionHeader = (label) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );

  const Riga = ({ label, valore }) => {
    if (valore === null || valore === undefined || valore === '') return null;
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0, marginRight: 16 }}>
          {label}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, textAlign: 'right', wordBreak: 'break-word' }}>
          {valore}
        </span>
      </div>
    );
  };

  const prezzoLabel = imm.tipo_acquisizione === 'ASTA' ? 'Base d\'Asta' : 'Prezzo Richiesto';

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onChiudi} />
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <h2 className="modal-title">Dettaglio Immobile</h2>
          <button className="modal-close" onClick={onChiudi}>×</button>
        </div>
        <div className="modal-body-col" style={{ minHeight: 0 }}>

          {/* ── Status bar ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: col }}>
              {imm.stato_interesse === 'COMPRATO' ? 'Acquistato' : imm.stato_interesse === 'INTERESSATO' ? 'Interessante' : 'Ceduto'}
            </span>
            {imm.preferito === 1 && <span style={{ fontSize: 14 }}>❤️</span>}
            {imm.fascia_omi && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                padding: '2px 10px', borderRadius: 6,
                background: `${FASCIA_COLOR[imm.fascia_omi] ?? 'var(--text-muted)'}22`,
                color: FASCIA_COLOR[imm.fascia_omi] ?? 'var(--text-muted)',
                border: `1px solid ${FASCIA_COLOR[imm.fascia_omi] ?? 'var(--text-muted)'}44`,
              }}>
                Fascia {imm.fascia_omi}
              </span>
            )}
          </div>

          {/* ── DATI IMMOBILE ──────────────────────────────────────────── */}
          {sectionHeader('Dati Immobile')}
          <Riga label="Indirizzo"    valore={imm.indirizzo} />
          <Riga label="Quartiere"    valore={imm.quartiere} />
          <Riga label="Città"        valore={imm.citta} />
          <Riga label="CAP"          valore={imm.cap} />
          <Riga label="Tipologia"    valore={imm.tipologia} />
          <Riga label="Superficie"   valore={imm.superficie_mq ? `${Math.round(Number(imm.superficie_mq))} mq` : null} />
          <Riga label={prezzoLabel}  valore={imm.prezzo_richiesto ? formatEuro(imm.prezzo_richiesto) : null} />
          <Riga label="Acquisizione" valore={imm.tipo_acquisizione} />
          <Riga label="Venditore"    valore={imm.venditore} />
          <Riga label="Stato Imm."   valore={imm.stato_immobile} />
          <Riga label="Fascia OMI"   valore={imm.fascia_omi} />
          {imm.data_inizio_asta && <Riga label="Data Asta"   valore={formatData(imm.data_inizio_asta)} />}
          <Riga label="Origine"      valore={imm.origine === 'VALUTAZIONE_AUTONOMA' ? 'Valuta Tu' : imm.origine === 'MANUALE' ? 'Manuale' : imm.origine} />
          <Riga label="Inserito il"  valore={formatData(imm.data_inserimento)} />

          {/* ── CARATTERISTICHE ────────────────────────────────────────── */}
          {sectionHeader('Caratteristiche')}
          <Riga label="Classe Energ." valore={imm.classe_energetica} />
          <Riga label="Esposizione"   valore={imm.esposizione} />
          <Riga label="Vista"         valore={imm.vista} />
          <Riga label="Qualità"       valore={imm.qualita_costruzione} />
          <Riga label="Luminosità"    valore={imm.luminosita} />
          <Riga label="Stato Cons."   valore={imm.stato_conservazione} />

          {/* ── SPECIFICHE FISICHE ─────────────────────────────────────── */}
          {sectionHeader('Specifiche Fisiche')}
          <Riga label="Piano"            valore={(imm.piano != null && imm.piano !== '') ? String(imm.piano) : null} />
          <Riga label="N° Locali"        valore={(imm.num_locali != null && imm.num_locali !== '') ? String(imm.num_locali) : null} />
          <Riga label="N° Bagni"         valore={(imm.num_bagni != null && imm.num_bagni !== '') ? String(imm.num_bagni) : null} />
          <Riga label="Anno Costruzione" valore={imm.anno_costruzione ? String(imm.anno_costruzione) : null} />
          <Riga label="Ascensore"        valore={imm.ascensore != null ? (imm.ascensore ? 'Sì' : 'No') : null} />
          <Riga label="Box / Posto Auto" valore={imm.box_auto != null ? (imm.box_auto ? 'Sì' : 'No') : null} />
          <Riga label="Balcone/Terrazzo" valore={imm.balcone_terrazza != null ? (imm.balcone_terrazza ? 'Sì' : 'No') : null} />
          <Riga label="Giardino"         valore={imm.giardino != null ? (imm.giardino ? 'Sì' : 'No') : null} />

          {/* ── LINK E RIFERIMENTI ─────────────────────────────────────── */}
          {(imm.url_annuncio || (imm.link_riferimento && /^https?:\/\//.test(imm.link_riferimento))) && (
            <>
              {sectionHeader('Link e Riferimenti')}
              {imm.url_annuncio && (
                <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <a href={imm.url_annuncio} target="_blank" rel="noreferrer"
                     style={{ color: 'var(--accent)', fontSize: 13 }}>
                    Vedi annuncio originale →
                  </a>
                </div>
              )}
              {imm.link_riferimento && /^https?:\/\//.test(imm.link_riferimento) && (
                <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <a href={imm.link_riferimento} target="_blank" rel="noreferrer"
                     style={{ color: 'var(--accent)', fontSize: 13 }}>
                    Link riferimento →
                  </a>
                </div>
              )}
            </>
          )}

          {/* ── ANALISI FINANZIARIA (solo se compilata) ────────────────── */}
          {(imm.prezzo_acquisto || imm.rendita_mensile_stimata || imm.rendimento_annuo_stimato_pct
            || imm.rendita_catastale || imm.spese_condominiali_mensili || imm.imu_annua || imm.tari_annua) && (
            <>
              {sectionHeader('Analisi Finanziaria')}
              <Riga label="Prezzo d'Acquisto"      valore={imm.prezzo_acquisto ? formatEuro(imm.prezzo_acquisto) : null} />
              <Riga label="Rendita Catastale"      valore={imm.rendita_catastale ? formatEuro(imm.rendita_catastale) : null} />
              <Riga label="Canone / Rendita /mese" valore={imm.rendita_mensile_stimata ? formatEuro(imm.rendita_mensile_stimata) : null} />
              <Riga label="Rendimento Annuo"       valore={imm.rendimento_annuo_stimato_pct ? formatPct(imm.rendimento_annuo_stimato_pct) : null} />
              <Riga label="Spese Cond./mese"       valore={imm.spese_condominiali_mensili ? formatEuro(imm.spese_condominiali_mensili) : null} />
              <Riga label="IMU Annua"              valore={imm.imu_annua ? formatEuro(imm.imu_annua) : null} />
              <Riga label="TARI Annua"             valore={imm.tari_annua ? formatEuro(imm.tari_annua) : null} />
            </>
          )}

          {/* ── VALUTAZIONE PERSONALE (solo se compilata) ──────────────── */}
          {(imm.prezzo_valutato_giusto || imm.giudizio_personale) && (
            <>
              {sectionHeader('Valutazione Personale')}
              <Riga label="Prezzo Giusto" valore={imm.prezzo_valutato_giusto ? formatEuro(imm.prezzo_valutato_giusto) : null} />
              {imm.giudizio_personale && (() => {
                const gKey = imm.giudizio_personale.toUpperCase().replace(/ /g, '_');
                const label = {
                  AFFARE: 'Affare', INTERESSANTE: 'Interessante', NELLA_MEDIA: 'Nella media',
                  SOPRAVVALUTATO: 'Sopravvalutato', DA_EVITARE: 'Da evitare',
                }[gKey] || imm.giudizio_personale;
                const c = GIUDIZIO_COLOR[gKey] || 'var(--text-muted)';
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0, marginRight: 16 }}>Giudizio</span>
                    <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: c }}>{label}</span>
                  </div>
                );
              })()}
            </>
          )}

          {/* ── NOTE PERSONALI — trigger riga ──────────────────────────── */}
          <div
            onClick={() => setNoteAperto(true)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, cursor: 'pointer', marginTop: 16,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>📋</span>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Note personali</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {note.length === 0
                    ? 'Nessuna nota — clicca per aggiungere'
                    : `${note.length} aggiornament${note.length === 1 ? 'o' : 'i'}`}
                </span>
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
          </div>

          {/* ── MODAL NOTE (sopra il Dettaglio) ────────────────────────── */}
          {noteAperto && (
            <>
              <div
                onClick={() => setNoteAperto(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000 }}
              />
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90%', maxWidth: 480, maxHeight: '80vh',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 20, zIndex: 10001,
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden'
              }}>

                {/* Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>Note personali</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {imm.indirizzo}
                    </span>
                  </div>
                  <button
                    onClick={() => setNoteAperto(false)}
                    style={{
                      background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                      width: 32, height: 32, cursor: 'pointer', color: 'var(--text)', fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >×</button>
                </div>

                {/* Lista scrollabile */}
                <div style={{
                  flex: 1, overflowY: 'auto', padding: '16px 20px',
                  display: 'flex', flexDirection: 'column', gap: 12
                }}>
                  {note.length === 0 ? (
                    <p style={{
                      textAlign: 'center', color: 'var(--text-muted)',
                      fontSize: 14, fontStyle: 'italic', marginTop: 24
                    }}>
                      Nessuna nota ancora.<br />Aggiungi il primo aggiornamento.
                    </p>
                  ) : (
                    [...note].reverse().map((voce, i) => (
                      <div key={i} style={{
                        background: i === 0 ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${i === 0 ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 12, padding: '12px 14px'
                      }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: i === 0 ? 'var(--accent)' : 'var(--text-muted)',
                          display: 'block', marginBottom: 8, letterSpacing: '0.04em'
                        }}>
                          {i === 0 ? '🕐 PIÙ RECENTE  · ' : ''}{formattaData(voce.data)}
                        </span>
                        <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {voce.testo}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer input */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                  <textarea
                    value={nuovaNota}
                    onChange={(e) => setNuovaNota(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) aggiungiNota(); }}
                    placeholder="Scrivi un aggiornamento... (Ctrl+Enter per salvare)"
                    style={{
                      width: '100%', minHeight: 80,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, padding: 12,
                      color: 'var(--text)', fontSize: 14,
                      resize: 'none', outline: 'none',
                      boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5,
                      transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                  />
                  <button
                    onClick={aggiungiNota}
                    disabled={!nuovaNota.trim() || salvando}
                    style={{
                      marginTop: 10, width: '100%',
                      background: nuovaNota.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                      border: 'none', borderRadius: 10, padding: '11px 0',
                      color: nuovaNota.trim() ? '#000' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    {salvando ? 'Salvataggio...' : '+ Aggiungi nota'}
                  </button>
                </div>

              </div>
            </>
          )}

        </div>{/* end modal-body-col */}
        <div style={{ flexShrink: 0, padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={onChiudi} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
            Chiudi
          </button>
          <button onClick={onModifica} style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            ✏ Modifica
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — IMMOBILI CENSITI (card grid 3 per riga, ricerca su tutte le categorie)
// ═══════════════════════════════════════════════════════════════════════════
function CensimentiTab() {
  const [immobili, setImmobili]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [subFiltro, setSubFiltro] = useState(null);
  const [modale, setModale]       = useState(false);
  const [editItem, setEditItem]   = useState(null);
  // Ricerca: quando attiva, mostra immobili da TUTTE le categorie
  const [ricerca, setRicerca]     = useState('');
  const [filtriAperto, setFiltriAperto] = useState(false);
  const [filtri, setFiltri]       = useState({ tipo_acquisizione: '', tipologia: '', prezzo_da: '', prezzo_a: '' });
  const [conferma, setConferma]   = useState(null);
  const [dettaglioItem, setDettaglioItem] = useState(null);
  const [form, setForm] = useState({
    indirizzo: '', quartiere: '', tipologia: '',
    superficie_mq: '', prezzo_richiesto: '', stato_interesse: 'INTERESSATO',
    stato_immobile: 'NORMALE', venditore: '', note: '',
    tipo_acquisizione: '', link_riferimento: '', data_inizio_asta: '',
    classe_energetica: 'MEDIA', esposizione: 'BUONA', vista: 'STANDARD',
    qualita_costruzione: 'STANDARD', luminosita: 'BUONA', stato_conservazione: 'NORMALE',
    fascia_omi: '',
    piano: '', num_locali: '', num_bagni: '', anno_costruzione: '',
    ascensore: false, box_auto: false, balcone_terrazza: false,
    prezzo_acquisto: '', spese_condominiali_mensili: '', imu_annua: '', tari_annua: '',
  });

  const carica = () => {
    setLoading(true);
    getCensimenti()
      .then(data => { setImmobili(data); console.log(`[CENSIMENTI] ${data.length} immobili caricati`); })
      .catch(err => console.error('[CENSIMENTI] Errore caricamento:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  function apriModale(item = null) {
    if (item) {
      setEditItem(item);
      setForm({
        indirizzo:           item.indirizzo         || '',
        quartiere:           item.quartiere         || '',
        tipologia:           item.tipologia         || '',
        superficie_mq:       item.superficie_mq     || '',
        prezzo_richiesto:    item.prezzo_richiesto ? String(Math.round(Number(item.prezzo_richiesto))) : '',
        stato_interesse:     item.stato_interesse   || 'INTERESSATO',
        stato_immobile:      item.stato_immobile    || 'NORMALE',
        venditore:           item.venditore         || '',
        note:                item.note              || '',
        tipo_acquisizione:   item.tipo_acquisizione || '',
        link_riferimento:    item.link_riferimento  || '',
        data_inizio_asta:    item.data_inizio_asta  ? item.data_inizio_asta.substring(0, 10) : '',
        classe_energetica:   item.classe_energetica   || 'MEDIA',
        esposizione:         item.esposizione         || 'BUONA',
        vista:               item.vista               || 'STANDARD',
        qualita_costruzione: item.qualita_costruzione || 'STANDARD',
        luminosita:          item.luminosita          || 'BUONA',
        stato_conservazione: item.stato_conservazione || 'NORMALE',
        fascia_omi:          item.fascia_omi          || '',
        piano:               item.piano               || '',
        num_locali:          item.num_locali  != null ? String(item.num_locali)  : '',
        num_bagni:           item.num_bagni   != null ? String(item.num_bagni)   : '',
        anno_costruzione:    item.anno_costruzione     ? String(item.anno_costruzione) : '',
        ascensore:           item.ascensore === 1,
        box_auto:            item.box_auto === 1,
        balcone_terrazza:    item.balcone_terrazza === 1,
        prezzo_acquisto:     item.prezzo_acquisto          ? String(Math.round(Number(item.prezzo_acquisto)))          : '',
        spese_condominiali_mensili: item.spese_condominiali_mensili ? String(item.spese_condominiali_mensili) : '',
        imu_annua:           item.imu_annua  ? String(item.imu_annua)  : '',
        tari_annua:          item.tari_annua ? String(item.tari_annua) : '',
      });
    } else {
      setEditItem(null);
      setForm({ indirizzo: '', quartiere: '', tipologia: '', superficie_mq: '', prezzo_richiesto: '', stato_interesse: 'INTERESSATO', stato_immobile: 'NORMALE', venditore: '', note: '', tipo_acquisizione: '', link_riferimento: '', data_inizio_asta: '', classe_energetica: 'MEDIA', esposizione: 'BUONA', vista: 'STANDARD', qualita_costruzione: 'STANDARD', luminosita: 'BUONA', stato_conservazione: 'NORMALE', fascia_omi: '', piano: '', num_locali: '', num_bagni: '', anno_costruzione: '', ascensore: false, box_auto: false, balcone_terrazza: false, prezzo_acquisto: '', spese_condominiali_mensili: '', imu_annua: '', tari_annua: '' });
    }
    setModale(true);
  }

  async function togglePreferito(id, valoreAttuale) {
    const nuovoValore = valoreAttuale ? 0 : 1;
    setImmobili(prev => prev.map(i => i.id === id ? { ...i, preferito: nuovoValore } : i));
    try {
      await togglePreferitoImmobile(id, nuovoValore);
    } catch (err) {
      console.error('[CENSIMENTI] Errore preferito:', err);
      setImmobili(prev => prev.map(i => i.id === id ? { ...i, preferito: valoreAttuale } : i));
    }
  }

  async function salva() {
    if (!form.indirizzo)        { alert('Inserisci la Via/Indirizzo'); return; }
    if (!form.tipologia)        { alert('Inserisci la Tipologia'); return; }
    if (!form.superficie_mq)    { alert('Inserisci i MQ'); return; }
    if (!form.prezzo_richiesto) { alert('Inserisci il Prezzo'); return; }
    if (!form.tipo_acquisizione){ alert('Seleziona la modalità di Acquisizione'); return; }
    if (form.tipo_acquisizione === 'ASTA' && !form.data_inizio_asta) {
      alert('Inserisci la Data Inizio Asta'); return;
    }
    try {
      const datiPuliti = {
        ...form,
        prezzo_richiesto: parsePrezzo(form.prezzo_richiesto) || form.prezzo_richiesto,
        superficie_mq:    parsePrezzo(form.superficie_mq)    || form.superficie_mq,
        prezzo_acquisto:  form.prezzo_acquisto ? parsePrezzo(form.prezzo_acquisto) || form.prezzo_acquisto : null,
        ascensore:        form.ascensore ? 1 : 0,
        box_auto:         form.box_auto  ? 1 : 0,
        balcone_terrazza: form.balcone_terrazza ? 1 : 0,
      };
      if (editItem) await aggiornaCensimento(editItem.id, datiPuliti);
      else await creaCensimento(datiPuliti);
      setModale(false);
      carica();
    } catch (err) {
      console.error('[CENSIMENTI] Errore salvataggio:', err);
    }
  }

  async function aggiornaNote(id, noteText) {
    await aggiornaNoteImmobile(id, noteText);
    setImmobili(prev => prev.map(i => i.id === id ? { ...i, note: noteText } : i));
    setDettaglioItem(prev => prev?.id === id ? { ...prev, note: noteText } : prev);
  }

  function chiediConferma(tipo, id, indirizzo, nuovoStato = null) {
    setConferma({ tipo, id, indirizzo, nuovoStato });
  }

  async function eseguiConferma() {
    if (!conferma) return;
    try {
      if (conferma.tipo === 'elimina') {
        await eliminaCensimento(conferma.id);
        setConferma(null);
        carica();
      } else {
        await cambiaStatoImmobile(conferma.id, conferma.nuovoStato);
        setImmobili(prev => prev.map(i =>
          i.id === conferma.id ? { ...i, stato_interesse: conferma.nuovoStato } : i
        ));
        setConferma(null);
      }
    } catch (err) {
      console.error('[CENSIMENTI] Errore operazione:', err);
      setConferma(null);
    }
  }

  // Filtra per subFiltro (toggle rapido), oppure mostra tutti
  const immobiliBase = subFiltro ? immobili.filter(i => i.stato_interesse === subFiltro) : immobili;
  const immobiliFiltrati = immobiliBase.filter(imm => {
    const q = ricerca.toLowerCase();
    const matchVia      = !q || (imm.indirizzo || '').toLowerCase().includes(q);
    const matchTipo     = !filtri.tipo_acquisizione || imm.tipo_acquisizione === filtri.tipo_acquisizione;
    const matchTipologia= !filtri.tipologia || (imm.tipologia || '').toLowerCase().includes(filtri.tipologia.toLowerCase());
    const prezzo        = parseFloat(imm.prezzo_richiesto) || 0;
    const matchDa       = !filtri.prezzo_da || prezzo >= parseFloat(parsePrezzo(filtri.prezzo_da));
    const matchA        = !filtri.prezzo_a  || prezzo <= parseFloat(parsePrezzo(filtri.prezzo_a));
    return matchVia && matchTipo && matchTipologia && matchDa && matchA;
  });

  const filtriAttivi = filtri.tipo_acquisizione || filtri.tipologia || filtri.prezzo_da || filtri.prezzo_a;

  // Colori e label per stato
  const statoInfo = {
    COMPRATO:      { dot: '#34d399', label: 'Acquistato' },
    INTERESSATO:   { dot: '#fbbf24', label: 'Interessante' },
    CEDUTO:        { dot: '#f87171', label: 'Ceduto' },
    VENDUTO_TERZI: { dot: '#f87171', label: 'Ceduto' }, // legacy
  };

  if (loading) return <LoadingSpinner text="Caricamento immobili..." />;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header: ricerca + filtri + NUOVO CENSIMENTO ─────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Barra di ricerca — cerca su tutte le categorie */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
            <input
              value={ricerca}
              onChange={e => setRicerca(e.target.value)}
              placeholder="Cerca per via…"
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderRadius: 10, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={() => setFiltriAperto(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: filtriAttivi ? 'rgba(245,158,11,0.15)' : 'var(--bg-secondary)', color: filtriAttivi ? 'var(--accent)' : 'var(--text-muted)', border: filtriAttivi ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ⊞ Filtri {filtriAttivi ? '·' : ''}
          </button>
        </div>

        {/* Pannello filtri avanzati */}
        {filtriAperto && (
          <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Acquisizione</p>
              <div className="flex flex-wrap gap-2">
                {[{ val: '', label: 'Tutte' }, { val: 'ASTA', label: 'ASTA' }, { val: 'AGENZIA', label: 'AGENZIA' }, { val: 'PRIVATO', label: 'PRIVATO' }].map(({ val, label }) => (
                  <button key={val} onClick={() => setFiltri(f => ({ ...f, tipo_acquisizione: val }))}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: filtri.tipo_acquisizione === val ? 'var(--accent)' : 'var(--bg-card)', color: filtri.tipo_acquisizione === val ? '#000' : 'var(--text-muted)', border: filtri.tipo_acquisizione === val ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tipologia</p>
              <input value={filtri.tipologia} onChange={e => setFiltri(f => ({ ...f, tipologia: e.target.value }))}
                placeholder="Es. Appartamento"
                style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: '100%', maxWidth: 220 }} />
            </div>
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prezzo (€)</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={filtri.prezzo_da} onChange={e => setFiltri(f => ({ ...f, prezzo_da: e.target.value }))}
                  placeholder="Da es. 100.000"
                  style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: 140 }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>–</span>
                <input value={filtri.prezzo_a} onChange={e => setFiltri(f => ({ ...f, prezzo_a: e.target.value }))}
                  placeholder="A es. 400.000"
                  style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: 140 }} />
              </div>
            </div>
            {filtriAttivi && (
              <button onClick={() => setFiltri({ tipo_acquisizione: '', tipologia: '', prezzo_da: '', prezzo_a: '' })}
                style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                × Rimuovi filtri
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Quick filter toggle ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: null,         label: 'Tutti',        color: 'var(--text-primary)' },
          { id: 'INTERESSATO', label: 'Interessante', color: '#fbbf24' },
          { id: 'COMPRATO',   label: 'Acquistato',   color: '#34d399' },
          { id: 'CEDUTO',     label: 'Ceduto',       color: '#f87171' },
        ].map(f => (
          <button
            key={String(f.id)}
            onClick={() => setSubFiltro(f.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: subFiltro === f.id ? `1px solid ${f.color}88` : '1px solid var(--border)',
              background: subFiltro === f.id ? `${f.color}22` : 'var(--bg-secondary)',
              color: subFiltro === f.id ? f.color : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {f.label}
            {f.id !== null && ` (${immobili.filter(i => i.stato_interesse === f.id).length})`}
          </button>
        ))}
      </div>

      {/* Contatore risultati */}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 4 }}>
        {immobiliFiltrati.length > 0 ? `${immobiliFiltrati.length} immobili` : 'Nessun risultato'}
      </p>

      {/* ── Grid card immobili ─────────────────────────────────────────── */}
      {immobili.length === 0 ? (
        <EmptyState icon="🏠" title="Nessun immobile censito" message="Usa 'Valuta Tu' o 'Wizard Valutazione' dalla sidebar per censire il primo immobile." />
      ) : immobiliFiltrati.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 32, marginBottom: 10 }}>🔍</p>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Nessun immobile trovato
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Prova con un altro indirizzo o aggiungi un nuovo censimento
          </p>
        </div>
      ) : (
        /* Layout card grid — 3 per riga su desktop (min 260px per card) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {immobiliFiltrati.map(imm => {
            const info = statoInfo[imm.stato_interesse] || { dot: 'var(--text-muted)', label: imm.stato_interesse };
            return (
              <div
                key={imm.id}
                className="rounded-xl overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => setDettaglioItem(imm)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Immagine placeholder con badge */}
                <div style={{ height: 130, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, position: 'relative', flexShrink: 0 }}>
                  🏠
                  {/* Badge tipologia acquisizione (PRIVATO / AGENZIA / ASTA) */}
                  {imm.tipo_acquisizione && (
                    <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: 'rgba(0,0,0,0.55)', color: '#fff', letterSpacing: '0.06em', backdropFilter: 'blur(4px)' }}>
                      {imm.tipo_acquisizione}
                    </span>
                  )}
                  {/* Badge stato categoria — visibile quando non c'è filtro attivo */}
                  {subFiltro === null && (
                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5, background: info.dot + '33', border: `1px solid ${info.dot}66`, color: info.dot }}>
                      {info.label}
                    </span>
                  )}
                  {/* Cuore preferito */}
                  {imm.preferito === 1 && (
                    <span style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 15 }}>❤️</span>
                  )}
                </div>

                {/* Contenuto card */}
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Stato dot + indirizzo */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: info.dot, flexShrink: 0, marginTop: 4 }} />
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                      {formatAddress(imm.indirizzo) || '–'}
                    </p>
                  </div>

                  {/* Tipologia · mq · quartiere */}
                  {(imm.tipologia || imm.superficie_mq || imm.quartiere) && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 15 }}>
                      {[imm.tipologia, formatMq(imm.superficie_mq), imm.quartiere].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {/* Prezzo + badge fonte acquisizione */}
                  {imm.prezzo_richiesto && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 15 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                        {formatEuro(imm.prezzo_richiesto)}
                      </span>
                      {imm.tipo_acquisizione && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {imm.tipo_acquisizione === 'ASTA' ? 'Asta' : imm.tipo_acquisizione === 'AGENZIA' ? 'Agenzia' : 'Privato'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Fascia OMI badge */}
                  {imm.fascia_omi && (() => {
                    const fc = { ALTA: 'var(--success)', MEDIA: 'var(--accent)', BASSA: 'var(--text-muted)' };
                    const c = fc[imm.fascia_omi] ?? 'var(--text-muted)';
                    return (
                      <div style={{ paddingLeft: 15 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${c}22`, color: c, border: `1px solid ${c}44` }}>
                          Fascia {imm.fascia_omi}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Rendimento + giudizio */}
                  {(imm.rendimento_annuo_stimato_pct || imm.giudizio_personale) && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 15 }}>
                      {[
                        imm.rendimento_annuo_stimato_pct ? `${imm.rendimento_annuo_stimato_pct}% rend.` : null,
                        imm.giudizio_personale,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {/* Link annuncio */}
                  {imm.url_annuncio && (
                    <div style={{ paddingLeft: 15 }}>
                      <a
                        href={imm.url_annuncio}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                      >
                        🔗 Vedi annuncio →
                      </a>
                    </div>
                  )}

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Pulsanti azione — stopPropagation per non aprire il dettaglio */}
                  <div style={{ display: 'flex', gap: 5, paddingTop: 10, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    {imm.stato_interesse === 'INTERESSATO' && (
                      <button
                        onClick={e => { e.stopPropagation(); togglePreferito(imm.id, imm.preferito); }}
                        title={imm.preferito ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: imm.preferito ? 'rgba(239,68,68,0.12)' : 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>
                        {imm.preferito ? '❤️' : '🤍'}
                      </button>
                    )}
                    <SpostaPopup imm={imm} onCambia={(id, indirizzo, nuovoStato) => chiediConferma('stato', id, indirizzo, nuovoStato)} />
                    <button
                      onClick={e => { e.stopPropagation(); apriModale(imm); }}
                      title="Modifica"
                      style={{ flex: 1, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                      ✏
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); chiediConferma('elimina', imm.id, imm.indirizzo); }}
                      title="Elimina"
                      style={{ flex: 1, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--danger)' }}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dettaglio immobile ─────────────────────────────────────────── */}
      {dettaglioItem && (
        <DettaglioImmobile
          imm={dettaglioItem}
          onChiudi={() => setDettaglioItem(null)}
          onModifica={() => { setDettaglioItem(null); apriModale(dettaglioItem); }}
          onAggiornaNote={aggiornaNote}
        />
      )}

      {/* ── Modal conferma (elimina / sposta) ──────────────────────────── */}
      {conferma && (
        <ModalConferma
          icona={conferma.tipo === 'elimina' ? '🗑' : '⇄'}
          titolo={conferma.tipo === 'elimina' ? 'Elimina immobile?' : 'Sposta immobile?'}
          messaggio={
            conferma.tipo === 'elimina'
              ? `Vuoi eliminare "${conferma.indirizzo}"? L'azione non è reversibile.`
              : `Sposta "${conferma.indirizzo}" in ${conferma.nuovoStato === 'COMPRATO' ? 'Acquistati' : conferma.nuovoStato === 'INTERESSATO' ? 'Interessanti' : 'Ceduti'}?`
          }
          labelConferma={conferma.tipo === 'elimina' ? 'Elimina' : 'Sposta'}
          coloreConferma={conferma.tipo === 'elimina' ? 'rgba(239,68,68,0.9)' : 'var(--accent)'}
          onConferma={eseguiConferma}
          onAnnulla={() => setConferma(null)}
        />
      )}

      {/* ── Modal form censimento ──────────────────────────────────────── */}
      {modale && (
        <Modal titolo={editItem ? 'Modifica Censimento' : 'Nuovo Censimento'} onChiudi={() => setModale(false)}>

          <div>
            <label className={labelCls} style={labelStyle}>Via / Indirizzo *</label>
            <input value={form.indirizzo} onChange={e => setForm(f => ({ ...f, indirizzo: e.target.value }))}
              placeholder="Via Roma, 12" className={inputCls}
              style={{ ...inputStyle, borderColor: !form.indirizzo ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Dettagli Immobile</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Quartiere</label>
              <input value={form.quartiere} onChange={e => setForm(f => ({ ...f, quartiere: e.target.value }))}
                placeholder="Es. Villanova" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipologia *</label>
              <input value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))}
                placeholder="Es. Appartamento" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.tipologia ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Superficie (mq) *</label>
              <input type="text" inputMode="decimal" value={form.superficie_mq}
                onChange={e => setForm(f => ({ ...f, superficie_mq: e.target.value }))}
                placeholder="Es. 80" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.superficie_mq ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Prezzo Richiesto (€) *</label>
              <input type="text" inputMode="decimal" value={form.prezzo_richiesto}
                onChange={e => setForm(f => ({ ...f, prezzo_richiesto: e.target.value }))}
                placeholder="Es. 400.000" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.prezzo_richiesto ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Puoi scrivere 400.000 oppure 400000</p>
              {form.tipo_acquisizione === 'ASTA' && (
                <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3, fontWeight: 600 }}>ℹ Per il caso d'asta si intende prezzo base</p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Stato & Acquisizione *</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Stato *</label>
              <select value={form.stato_interesse} onChange={e => setForm(f => ({ ...f, stato_interesse: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="COMPRATO">✓ Acquistato</option>
                <option value="INTERESSATO">◎ Interessato</option>
                <option value="CEDUTO">→ Ceduto</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Acquisizione *</label>
              <select value={form.tipo_acquisizione} onChange={e => setForm(f => ({ ...f, tipo_acquisizione: e.target.value }))}
                className={inputCls}
                style={{ ...inputStyle, borderColor: !form.tipo_acquisizione ? 'rgba(245,158,11,0.7)' : 'var(--border)' }}>
                <option value="">-- Seleziona --</option>
                <option value="ASTA">ASTA</option>
                <option value="AGENZIA">AGENZIA</option>
                <option value="PRIVATO">PRIVATO</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Immobile</label>
              <select value={form.stato_immobile} onChange={e => setForm(f => ({ ...f, stato_immobile: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="NORMALE">Normale</option>
                <option value="OTTIMO">Ottimo</option>
                <option value="SCADENTE">Scadente / Da ristr.</option>
              </select>
            </div>
          </div>

          {form.tipo_acquisizione === 'ASTA' && (
            <div>
              <label className={labelCls} style={labelStyle}>Data Inizio Asta *</label>
              <input type="date" value={form.data_inizio_asta} onChange={e => setForm(f => ({ ...f, data_inizio_asta: e.target.value }))}
                className={inputCls}
                style={{ ...inputStyle, borderColor: !form.data_inizio_asta ? 'rgba(245,158,11,0.7)' : 'var(--border)' }} />
            </div>
          )}

          {/* ── CARATTERISTICHE IMMOBILE ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Caratteristiche Immobile</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}>
            Queste caratteristiche determinano la fascia OMI (BASSA / MEDIA / ALTA).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Classe Energetica</label>
              <select value={form.classe_energetica} onChange={e => setForm(f => ({ ...f, classe_energetica: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="BASSA">BASSA (F-G)</option>
                <option value="MEDIA">MEDIA (C-D-E)</option>
                <option value="ALTA">ALTA (A-B)</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Esposizione</label>
              <select value={form.esposizione} onChange={e => setForm(f => ({ ...f, esposizione: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="SCARSA">SCARSA (Nord)</option>
                <option value="BUONA">BUONA (Est/Ovest)</option>
                <option value="OTTIMA">OTTIMA (Sud)</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Vista</label>
              <select value={form.vista} onChange={e => setForm(f => ({ ...f, vista: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="COMUNE">COMUNE (Cortile)</option>
                <option value="STANDARD">STANDARD (Strada)</option>
                <option value="PREGIATA">PREGIATA (Mare/Pan.)</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Qualità Costruzione</label>
              <select value={form.qualita_costruzione} onChange={e => setForm(f => ({ ...f, qualita_costruzione: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="ECONOMICA">ECONOMICA</option>
                <option value="STANDARD">STANDARD</option>
                <option value="PREGIATA">PREGIATA</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Luminosità</label>
              <select value={form.luminosita} onChange={e => setForm(f => ({ ...f, luminosita: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="SCARSA">SCARSA</option>
                <option value="BUONA">BUONA</option>
                <option value="OTTIMA">OTTIMA</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Stato Conservazione</label>
              <select value={form.stato_conservazione} onChange={e => setForm(f => ({ ...f, stato_conservazione: e.target.value }))}
                className={inputCls} style={inputStyle}>
                <option value="SCADENTE">SCADENTE</option>
                <option value="NORMALE">NORMALE</option>
                <option value="OTTIMO">OTTIMO</option>
              </select>
            </div>
          </div>

          {/* ── SPECIFICHE FISICHE ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Specifiche Fisiche</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Piano</label>
              <input value={form.piano} onChange={e => setForm(f => ({ ...f, piano: e.target.value }))}
                placeholder="Es. 2°" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>N° Locali</label>
              <input type="number" min="0" value={form.num_locali} onChange={e => setForm(f => ({ ...f, num_locali: e.target.value }))}
                placeholder="Es. 3" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>N° Bagni</label>
              <input type="number" min="0" value={form.num_bagni} onChange={e => setForm(f => ({ ...f, num_bagni: e.target.value }))}
                placeholder="Es. 1" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Anno Costruzione</label>
              <input type="number" min="1800" max="2099" value={form.anno_costruzione} onChange={e => setForm(f => ({ ...f, anno_costruzione: e.target.value }))}
                placeholder="Es. 1980" className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 4 }}>
            {[
              { field: 'ascensore',        label: 'Ascensore' },
              { field: 'box_auto',         label: 'Box / Posto Auto' },
              { field: 'balcone_terrazza', label: 'Balcone / Terrazzo' },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={!!form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>

          {/* ── DATI FINANZIARI ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Dati Finanziari</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Prezzo di Acquisto (€)</label>
              <input type="text" inputMode="decimal" value={form.prezzo_acquisto}
                onChange={e => setForm(f => ({ ...f, prezzo_acquisto: e.target.value }))}
                placeholder="Es. 350.000" className={inputCls} style={inputStyle} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Prezzo effettivamente pagato</p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Spese Condominiali/mese (€)</label>
              <input type="text" inputMode="decimal" value={form.spese_condominiali_mensili}
                onChange={e => setForm(f => ({ ...f, spese_condominiali_mensili: e.target.value }))}
                placeholder="Es. 150" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>IMU Annua (€)</label>
              <input type="text" inputMode="decimal" value={form.imu_annua}
                onChange={e => setForm(f => ({ ...f, imu_annua: e.target.value }))}
                placeholder="Es. 800" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>TARI Annua (€)</label>
              <input type="text" inputMode="decimal" value={form.tari_annua}
                onChange={e => setForm(f => ({ ...f, tari_annua: e.target.value }))}
                placeholder="Es. 300" className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* ── LINK & INFORMAZIONI ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Link & Informazioni</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>URL di Riferimento</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔗</span>
              <input type="url" value={form.link_riferimento} onChange={e => setForm(f => ({ ...f, link_riferimento: e.target.value }))}
                placeholder="https://..." className={inputCls}
                style={{ ...inputStyle, paddingLeft: 38 }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Venditore / Contatto</label>
              <input value={form.venditore} onChange={e => setForm(f => ({ ...f, venditore: e.target.value }))}
                placeholder="Nome agente o privato" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Informazioni</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2} placeholder="Informazioni sull'immobile..." className={inputCls}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />
          <div className="flex justify-center gap-3">
            <button onClick={() => setModale(false)}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={salva}
              style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {editItem ? 'Salva Modifiche' : 'Aggiungi'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Calcola durata contratto ─────────────────────────────────────────────
function calcDurata(inizio, fine) {
  if (!inizio || !fine) return null;
  const mesi = Math.round((new Date(fine) - new Date(inizio)) / (1000 * 60 * 60 * 24 * 30.4));
  if (mesi <= 0) return null;
  const anni = Math.floor(mesi / 12);
  const rm   = mesi % 12;
  if (anni === 0) return `${mesi} mesi`;
  return rm > 0 ? `${anni}a ${rm}m` : `${anni} anni`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — LOCAZIONI (ATTIVE + PASSATE)
// ═══════════════════════════════════════════════════════════════════════════
function LocazioniTab() {
  const [locazioni, setLocazioni]     = useState([]);
  const [loading, setLoading]         = useState(true);
  // Sub-tab: 'ATTIVE' | 'PASSATE'
  const [subTab, setSubTab]           = useState('ATTIVE');
  const [modale, setModale]           = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [erroreForm, setErroreForm]   = useState('');
  // Conferma modale per: elimina, chiudi, vendita, riattiva
  const [conferma, setConferma]       = useState(null);
  // Rinnova: apre mini-modal con input data
  const [rinnovaItem, setRinnovaItem] = useState(null);
  const [nuovaDataFine, setNuovaDataFine] = useState('');
  const [erroreRinnova, setErroreRinnova] = useState('');
  const [form, setForm] = useState({
    indirizzo: '', quartiere: '', tipologia: '', superficie_mq: '', canone_mensile: '',
    nome_inquilino: '', cognome_inquilino: '', email_inquilino: '', telefono_inquilino: '',
    data_inizio: '', data_fine: '', stato: 'ATTIVA', note: '',
    tipo_contratto: '', deposito_cauzionale: '',
  });

  const carica = () => {
    setLoading(true);
    getLocazioni()
      .then(data => { setLocazioni(data); console.log(`[LOCAZIONI] ${data.length} locazioni caricate`); })
      .catch(err => console.error('[LOCAZIONI] Errore caricamento:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  // Rileva se un contratto è scaduto (data_fine < oggi)
  function isScaduta(loc) {
    if (!loc.data_fine) return false;
    return loc.data_fine.substring(0, 10) < oggi;
  }

  // Split: attive (stato=ATTIVA) vs passate (TERMINATA, SCADUTA, VENDUTA)
  const locazioniAttive  = locazioni.filter(l => l.stato === 'ATTIVA');
  const locazioniPassate = locazioni.filter(l => ['TERMINATA', 'SCADUTA', 'VENDUTA'].includes(l.stato));
  const locMostrate      = subTab === 'ATTIVE' ? locazioniAttive : locazioniPassate;

  // Contratti attivi con scadenza già passata → mostra banner di notifica
  const scaduteAttive = locazioniAttive.filter(isScaduta);

  function apriModale(item = null) {
    setErroreForm('');
    if (item) {
      setEditItem(item);
      setForm({
        indirizzo:          item.indirizzo || '',
        quartiere:          item.quartiere || '',
        tipologia:          item.tipologia || '',
        superficie_mq:      item.superficie_mq || '',
        canone_mensile:     item.canone_mensile || '',
        nome_inquilino:     item.nome_inquilino || '',
        cognome_inquilino:  item.cognome_inquilino || '',
        email_inquilino:    item.email_inquilino || '',
        telefono_inquilino: item.telefono_inquilino || '',
        data_inizio:        item.data_inizio ? item.data_inizio.substring(0, 10) : '',
        data_fine:          item.data_fine   ? item.data_fine.substring(0, 10)   : '',
        stato:              item.stato || 'ATTIVA',
        note:               item.note || '',
        tipo_contratto:     item.tipo_contratto     || '',
        deposito_cauzionale:item.deposito_cauzionale != null ? String(item.deposito_cauzionale) : '',
      });
    } else {
      setEditItem(null);
      setForm({ indirizzo: '', quartiere: '', tipologia: '', superficie_mq: '', canone_mensile: '', nome_inquilino: '', cognome_inquilino: '', email_inquilino: '', telefono_inquilino: '', data_inizio: '', data_fine: '', stato: 'ATTIVA', note: '', tipo_contratto: '', deposito_cauzionale: '' });
    }
    setModale(true);
  }

  async function salva() {
    setErroreForm('');
    // Validazione campi obbligatori
    if (!form.indirizzo) { setErroreForm('Inserisci l\'indirizzo dell\'immobile'); return; }
    if (!form.canone_mensile) { setErroreForm('Inserisci il canone mensile'); return; }
    // Validazione data fine: per nuove locazioni, la data non può essere già scaduta
    if (!editItem && form.data_fine && form.data_fine < oggi) {
      setErroreForm('La data di fine contratto non può essere già nel passato');
      return;
    }
    try {
      if (editItem) await aggiornaLocazione(editItem.id, form);
      else await creaLocazione(form);
      setModale(false);
      carica();
      console.log(`[LOCAZIONI] Locazione ${editItem ? 'aggiornata' : 'creata'}`);
    } catch (err) {
      console.error('[LOCAZIONI] Errore salvataggio:', err);
      setErroreForm('Errore durante il salvataggio. Riprova.');
    }
  }

  // Le colonne data_inizio/data_fine sono DATE in MySQL → richiede "YYYY-MM-DD".
  // mysql2 le restituisce come Date objects serializzati in ISO ("…T00:00:00.000Z"):
  // bisogna troncare al formato corretto prima di inviare il PUT.
  function fmtDate(v) {
    if (!v) return null;
    const s = typeof v === 'string' ? v : v.toISOString();
    return s.substring(0, 10);
  }
  function locPayload(loc, nuovoStato) {
    return {
      ...loc,
      stato:       nuovoStato,
      data_inizio: fmtDate(loc.data_inizio),
      data_fine:   fmtDate(loc.data_fine),
    };
  }

  async function eseguiConferma() {
    if (!conferma) return;
    const loc = locazioni.find(l => l.id === conferma.id);
    const { tipo, id } = conferma;

    // Optimistic update — aggiorna lo stato locale immediatamente
    if (tipo === 'elimina') {
      setLocazioni(prev => prev.filter(l => l.id !== id));
    } else if (tipo === 'chiudi') {
      setLocazioni(prev => prev.map(l => l.id === id ? { ...l, stato: 'TERMINATA' } : l));
      setSubTab('PASSATE');
    } else if (tipo === 'vendita') {
      setLocazioni(prev => prev.map(l => l.id === id ? { ...l, stato: 'VENDUTA' } : l));
      setSubTab('PASSATE');
    } else if (tipo === 'riattiva') {
      setLocazioni(prev => prev.map(l => l.id === id ? { ...l, stato: 'ATTIVA' } : l));
      setSubTab('ATTIVE');
    }
    setConferma(null);

    try {
      if (tipo === 'elimina') {
        await eliminaLocazione(id);
      } else if (tipo === 'chiudi') {
        await aggiornaLocazione(id, locPayload(loc, 'TERMINATA'));
      } else if (tipo === 'vendita') {
        await aggiornaLocazione(id, locPayload(loc, 'VENDUTA'));
      } else if (tipo === 'riattiva') {
        await aggiornaLocazione(id, locPayload(loc, 'ATTIVA'));
      }
    } catch (err) {
      console.error('[LOCAZIONI] Errore operazione:', err);
      carica(); // rollback se il server fallisce
    }
  }

  async function eseguiRinnova() {
    setErroreRinnova('');
    if (!nuovaDataFine) { setErroreRinnova('Inserisci la nuova data di fine'); return; }
    if (nuovaDataFine <= oggi) { setErroreRinnova('La nuova data deve essere futura'); return; }
    const loc = locazioni.find(l => l.id === rinnovaItem.id);
    try {
      await aggiornaLocazione(rinnovaItem.id, { ...loc, stato: 'ATTIVA', data_inizio: fmtDate(loc.data_inizio), data_fine: nuovaDataFine });
      console.log(`[LOCAZIONI] Locazione ${rinnovaItem.id} rinnovata fino al ${nuovaDataFine}`);
      setRinnovaItem(null);
      carica();
    } catch (err) {
      console.error('[LOCAZIONI] Errore rinnovo:', err);
      setErroreRinnova('Errore durante il rinnovo. Riprova.');
    }
  }

  function giorniRimanenti(dataFine) {
    if (!dataFine) return null;
    return Math.ceil((new Date(dataFine) - new Date()) / (1000 * 60 * 60 * 24));
  }

  // Configurazione modal conferma
  const configConferma = conferma ? {
    elimina:  { icona: '🗑', titolo: 'Elimina locazione?',       messaggio: `Elimina definitivamente "${conferma.indirizzo}"? I dati storici andranno persi.`, label: 'Elimina',  colore: 'rgba(239,68,68,0.9)' },
    chiudi:   { icona: '✕', titolo: 'Chiudi contratto?',         messaggio: `Chiudi la locazione di "${conferma.indirizzo}"? Verrà spostata nelle Locazioni Passate.`, label: 'Chiudi',   colore: 'rgba(100,116,139,0.9)' },
    vendita:  { icona: '→', titolo: 'Sposta su Locazioni Passate?', messaggio: `La locazione "${conferma.indirizzo}" verrà spostata nelle Locazioni Passate.`, label: 'Sposta su Passate', colore: 'rgba(100,116,139,0.9)' },
    riattiva: { icona: '↻', titolo: 'Riattiva locazione?',       messaggio: `Riporta "${conferma.indirizzo}" tra le Locazioni Attive?`, label: 'Riattiva',  colore: 'var(--accent)' },
  }[conferma.tipo] : null;

  if (loading) return <LoadingSpinner text="Caricamento locazioni..." />;

  const totaleCanoni = locazioniAttive.reduce((s, l) => s + parseFloat(l.canone_mensile || 0), 0);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Banner: notifica contratti scaduti ─────────────────────────── */}
      {scaduteAttive.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
              {scaduteAttive.length === 1 ? '1 contratto scaduto' : `${scaduteAttive.length} contratti scaduti`}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Verifica i contratti evidenziati e scegli se rinnovare, chiudere o segnare come venduto.
            </p>
          </div>
        </div>
      )}

      {/* ── Header: totale + pulsante nuova locazione ──────────────────── */}
      <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {locazioniAttive.length} attive
          {totaleCanoni > 0 && ` · ${formatEuro(totaleCanoni)}/mese`}
          {locazioniPassate.length > 0 && ` · ${locazioniPassate.length} passate`}
        </p>
        <button onClick={() => apriModale()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          + Nuova Locazione
        </button>
      </div>

      {/* ── Sub-tabs: ATTIVE / PASSATE ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'ATTIVE',  label: 'Locazioni Attive',  count: locazioniAttive.length,  color: '#34d399' },
          { id: 'PASSATE', label: 'Locazioni Passate', count: locazioniPassate.length, color: '#94a3b8' },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{
              padding: '10px 18px', fontSize: 13,
              fontWeight: subTab === t.id ? 700 : 500,
              color: subTab === t.id ? t.color : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: subTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
            }}>
            {t.label}
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700, background: subTab === t.id ? t.color : 'var(--bg-secondary)', color: subTab === t.id ? '#000' : 'var(--text-muted)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Lista locazioni ─────────────────────────────────────────────── */}
      {locMostrate.length === 0 ? (
        <EmptyState
          icon={subTab === 'ATTIVE' ? '🔑' : '📁'}
          title={subTab === 'ATTIVE' ? 'Nessuna locazione attiva' : 'Nessuna locazione passata'}
          message={subTab === 'ATTIVE' ? 'Aggiungi i contratti di affitto attivi per tenerli monitorati.' : 'I contratti chiusi, scaduti e gli immobili venduti appariranno qui.'}
          action={subTab === 'ATTIVE'
            ? <button onClick={() => apriModale()} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Aggiungi prima locazione</button>
            : null
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {locMostrate.map(loc => {
            const giorni = giorniRimanenti(loc.data_fine);
            const exp    = isScaduta(loc) && subTab === 'ATTIVE';

            const isVenduta = loc.stato === 'VENDUTA';
            return (
              <div key={loc.id} className="rounded-xl overflow-hidden"
                style={{
                  background: exp ? 'rgba(239,68,68,0.03)' : isVenduta ? 'rgba(59,130,246,0.025)' : 'var(--bg-card)',
                  border: `1px solid ${exp ? 'rgba(239,68,68,0.45)' : isVenduta ? 'rgba(59,130,246,0.35)' : 'var(--border)'}`,
                }}>

                {/* ── Header card ────────────────────────────────────── */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: exp ? 'rgba(239,68,68,0.07)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Dot stato */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: exp ? '#ef4444' : subTab === 'ATTIVE' ? '#10b981' : loc.stato === 'VENDUTA' ? '#3b82f6' : '#94a3b8', flexShrink: 0 }} />
                  {/* Indirizzo */}
                  <h3 style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>
                    {formatAddress(loc.indirizzo)}
                  </h3>
                  {/* Badge stato */}
                  <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: exp ? 'rgba(239,68,68,0.15)' : loc.stato === 'VENDUTA' ? 'rgba(59,130,246,0.15)' : loc.stato === 'ATTIVA' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                    color: exp ? 'var(--danger)' : loc.stato === 'VENDUTA' ? 'var(--info)' : loc.stato === 'ATTIVA' ? 'var(--success)' : 'var(--text-muted)',
                  }}>
                    {exp ? '⚠ SCADUTA' : loc.stato === 'VENDUTA' ? '→ PASSATO' : loc.stato === 'TERMINATA' ? '✕ CHIUSO' : loc.stato === 'SCADUTA' ? 'SCADUTO' : loc.stato}
                  </span>
                  {/* Canone */}
                  {loc.canone_mensile && (
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>
                      {formatEuro(loc.canone_mensile)}/m
                    </span>
                  )}
                </div>

                {/* ── Body card ──────────────────────────────────────── */}
                <div style={{ padding: '16px' }}>

                  {/* ── Banner VENDUTO ──────────────────────────────── */}
                  {isVenduta && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 16px', borderRadius: 10, marginBottom: 16,
                      background: 'rgba(59,130,246,0.07)',
                      border: '1px solid rgba(59,130,246,0.22)',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 900, letterSpacing: '0.2em',
                        color: '#3b82f6', background: 'rgba(59,130,246,0.15)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        padding: '4px 12px', borderRadius: 6,
                      }}>
                        VENDUTO
                      </span>
                      {loc.data_fine && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Immobile venduto · {formatData(loc.data_fine)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {subTab === 'PASSATE' ? 'Ex Inquilino' : 'Inquilino'}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {[loc.nome_inquilino, loc.cognome_inquilino].filter(Boolean).join(' ') || '–'}
                      </p>
                      {loc.email_inquilino && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{loc.email_inquilino}</p>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Inizio</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{formatData(loc.data_inizio)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {subTab === 'PASSATE' ? 'Fine Contratto' : 'Scadenza'}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: exp ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {loc.data_fine ? formatData(loc.data_fine) : '–'}
                      </p>
                      {giorni !== null && subTab === 'ATTIVE' && (
                        <p style={{ fontSize: 11, color: exp ? 'var(--danger)' : 'var(--text-muted)', marginTop: 2 }}>
                          {exp ? `Scaduta ${Math.abs(giorni)}gg fa` : `${giorni}gg rimasti`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tipologia + mq + durata + tipo contratto */}
                  {(loc.tipologia || loc.superficie_mq || loc.tipo_contratto || loc.data_inizio) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {(loc.tipologia || loc.superficie_mq) && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {[loc.tipologia, formatMq(loc.superficie_mq)].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {loc.tipo_contratto && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(245,158,11,0.12)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.25)' }}>
                          {loc.tipo_contratto}
                        </span>
                      )}
                      {calcDurata(loc.data_inizio, loc.data_fine) && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Durata: {calcDurata(loc.data_inizio, loc.data_fine)}
                        </span>
                      )}
                      {loc.deposito_cauzionale && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Deposito: {formatEuro(loc.deposito_cauzionale)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Pulsanti azione ─────────────────────────────── */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                    {subTab === 'ATTIVE' ? (
                      <>
                        {/* RINNOVA */}
                        <button
                          onClick={() => { setRinnovaItem(loc); setNuovaDataFine(''); setErroreRinnova(''); }}
                          style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          ↻ Rinnova
                        </button>
                        {/* CHIUDI LOCAZIONE */}
                        <button
                          onClick={() => setConferma({ tipo: 'chiudi', id: loc.id, indirizzo: loc.indirizzo })}
                          style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          ✕ Chiudi
                        </button>
                        {/* SPOSTA SU LOCAZIONI PASSATE */}
                        <button
                          onClick={() => setConferma({ tipo: 'vendita', id: loc.id, indirizzo: loc.indirizzo })}
                          style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(100,116,139,0.1)', color: 'var(--text-secondary)', border: '1px solid rgba(100,116,139,0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          → Venduta
                        </button>
                        {/* MODIFICA (destra) */}
                        <button
                          onClick={() => apriModale(loc)}
                          style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          ✏ Modifica
                        </button>
                      </>
                    ) : (
                      <>
                        {/* RIATTIVA */}
                        <button
                          onClick={() => setConferma({ tipo: 'riattiva', id: loc.id, indirizzo: loc.indirizzo })}
                          style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          ↻ Riattiva
                        </button>
                        {/* ELIMINA (destra) */}
                        <button
                          onClick={() => setConferma({ tipo: 'elimina', id: loc.id, indirizzo: loc.indirizzo })}
                          style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          🗑 Elimina
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal RINNOVA: inserisci nuova data fine ────────────────────── */}
      {rinnovaItem && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setRinnovaItem(null)} />
          <div className="modal-box modal-box-sm">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">↻ Rinnova Contratto</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{rinnovaItem.indirizzo}</p>
              </div>
              <button className="modal-close" onClick={() => setRinnovaItem(null)}>×</button>
            </div>
            <div className="modal-body-col">
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.01em' }}>
                  Nuova data di fine contratto
                </label>
                <input
                  type="date"
                  min={oggi}
                  value={nuovaDataFine}
                  onChange={e => { setNuovaDataFine(e.target.value); setErroreRinnova(''); }}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 13, background: 'var(--bg-secondary)', border: `1px solid ${erroreRinnova ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                />
                {erroreRinnova && (
                  <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6 }}>⚠ {erroreRinnova}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setRinnovaItem(null)} className="btn-touch"
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Annulla
                </button>
                <button onClick={eseguiRinnova} className="btn-touch"
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  Conferma Rinnovo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal CONFERMA (chiudi / vendita / riattiva / elimina) ──────── */}
      {conferma && configConferma && (
        <ModalConferma
          icona={configConferma.icona}
          titolo={configConferma.titolo}
          messaggio={configConferma.messaggio}
          labelConferma={configConferma.label}
          coloreConferma={configConferma.colore}
          onConferma={eseguiConferma}
          onAnnulla={() => setConferma(null)}
        />
      )}

      {/* ── Modal FORM locazione ────────────────────────────────────────── */}
      {modale && (
        <Modal titolo={editItem ? 'Modifica Locazione' : 'Nuova Locazione'} onChiudi={() => setModale(false)}>

          {erroreForm && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}>
              ⚠ {erroreForm}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Indirizzo Immobile *</label>
              <input required value={form.indirizzo} onChange={e => { setForm(f => ({ ...f, indirizzo: e.target.value })); setErroreForm(''); }}
                placeholder="Via Roma, 12" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.indirizzo && erroreForm ? 'var(--danger)' : 'var(--border)' }} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Quartiere</label>
              <input value={form.quartiere} onChange={e => setForm(f => ({ ...f, quartiere: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Tipologia</label>
              <input value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))} placeholder="Es. Appartamento" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Superficie (mq)</label>
              <input type="number" value={form.superficie_mq} onChange={e => setForm(f => ({ ...f, superficie_mq: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Canone Mensile (€) *</label>
              <input type="number" value={form.canone_mensile} onChange={e => { setForm(f => ({ ...f, canone_mensile: e.target.value })); setErroreForm(''); }}
                placeholder="Es. 800" className={inputCls}
                style={{ ...inputStyle, borderColor: !form.canone_mensile && erroreForm ? 'var(--danger)' : 'var(--border)' }} />
            </div>

            <div className="sm:col-span-2">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Dati Inquilino</p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Nome Inquilino</label>
              <input value={form.nome_inquilino} onChange={e => setForm(f => ({ ...f, nome_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Cognome Inquilino</label>
              <input value={form.cognome_inquilino} onChange={e => setForm(f => ({ ...f, cognome_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Email Inquilino</label>
              <input type="email" value={form.email_inquilino} onChange={e => setForm(f => ({ ...f, email_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Telefono Inquilino</label>
              <input type="tel" value={form.telefono_inquilino} onChange={e => setForm(f => ({ ...f, telefono_inquilino: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Data Inizio Contratto</label>
              <input type="date" value={form.data_inizio} onChange={e => setForm(f => ({ ...f, data_inizio: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Data Fine Contratto</label>
              <input type="date" value={form.data_fine}
                onChange={e => { setForm(f => ({ ...f, data_fine: e.target.value })); setErroreForm(''); }}
                className={inputCls}
                style={{ ...inputStyle, borderColor: !editItem && form.data_fine && form.data_fine < oggi ? 'var(--danger)' : 'var(--border)' }} />
              {!editItem && form.data_fine && form.data_fine < oggi && (
                <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>La data è già nel passato</p>
              )}
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Stato Contratto</label>
              <select value={form.stato} onChange={e => setForm(f => ({ ...f, stato: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="ATTIVA">Attiva</option>
                <option value="SCADUTA">Scaduta</option>
                <option value="TERMINATA">Terminata</option>
                <option value="VENDUTA">Venduta</option>
              </select>
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Tipo Contratto</label>
              <select value={form.tipo_contratto} onChange={e => setForm(f => ({ ...f, tipo_contratto: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">-- Seleziona --</option>
                <option value="4+4">4+4 (libero mercato)</option>
                <option value="3+2">3+2 (canone concordato)</option>
                <option value="TRANSITORIO">Transitorio</option>
                <option value="STUDENTI">Uso Studenti</option>
                <option value="BREVE">Breve durata</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Deposito Cauzionale (€)</label>
              <input type="number" value={form.deposito_cauzionale}
                onChange={e => setForm(f => ({ ...f, deposito_cauzionale: e.target.value }))}
                placeholder="Es. 2400" className={inputCls} style={inputStyle} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls} style={labelStyle}>Informazioni</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} className={inputCls} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => setModale(false)}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
              Annulla
            </button>
            <button onClick={salva}
              style={{ padding: '10px 28px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {editItem ? 'Salva Modifiche' : 'Aggiungi'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — VALUTAZIONI ESEGUITE (dal Wizard)
// ═══════════════════════════════════════════════════════════════════════════
const GIUDIZIO_LABEL = { AFFARE: 'Affare', INTERESSANTE: 'Interessante', NELLA_MEDIA: 'Nella media', SOPRAVVALUTATO: 'Sopravvalutato', DA_EVITARE: 'Da evitare' };
const GIUDIZIO_COL   = { AFFARE: '#34d399', INTERESSANTE: '#a3e635', NELLA_MEDIA: '#fbbf24', SOPRAVVALUTATO: '#fb923c', DA_EVITARE: '#f87171' };

function ValutazioniTab() {
  const navigate = useNavigate();
  const [immobili, setImmobili]         = useState([]);
  const [valAutonome, setValAutonome]   = useState([]);
  const [summary, setSummary]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [rimuovendo, setRimuovendo]     = useState(null);
  const [conferma, setConferma]         = useState(null);
  const [duplicaItem, setDuplicaItem]   = useState(null);
  const [duplicaStato, setDuplicaStato] = useState('INTERESSATO');
  const [duplicando, setDuplicando]     = useState(false);
  const [erroreOps, setErroreOps]       = useState(null);
  const [censicitoId, setCensicitoId]   = useState(null);
  const [confermaAut, setConfermaAut]   = useState(null); // conferma elimina valutazione autonoma
  const [eliminandoAut, setEliminandoAut] = useState(null);

  const carica = () => {
    setLoading(true);
    Promise.all([getPortafoglio(), getSummaryPortafoglio(), getCensimenti()])
      .then(([lista, sum, censimenti]) => {
        console.log(`[VALUTAZIONI] ${lista.length} wizard, ${censimenti.filter(c => c.origine === 'VALUTAZIONE_AUTONOMA').length} autonome`);
        setImmobili(lista);
        setSummary(sum);
        setValAutonome(censimenti.filter(c => c.origine === 'VALUTAZIONE_AUTONOMA'));
      })
      .catch(err => console.error('[VALUTAZIONI] Errore:', err))
      .finally(() => setLoading(false));
  };
  useEffect(carica, []);

  async function eseguiRimuovi() {
    if (!conferma) return;
    setRimuovendo(conferma.id);
    try {
      await rimuoviDaPortafoglio(conferma.id);
      console.log(`[VALUTAZIONI] Rimossa valutazione ${conferma.id}`);
      setConferma(null);
      carica();
    } catch (err) {
      console.error('[VALUTAZIONI] Errore rimozione:', err);
      setConferma(null);
    } finally {
      setRimuovendo(null);
    }
  }

  async function eseguiEliminaAut() {
    if (!confermaAut) return;
    setEliminandoAut(confermaAut.id);
    try {
      await eliminaCensimento(confermaAut.id);
      setValAutonome(prev => prev.filter(v => v.id !== confermaAut.id));
      setConfermaAut(null);
    } catch (err) {
      console.error('[VALUTAZIONI] Errore eliminazione autonoma:', err);
      setConfermaAut(null);
    } finally {
      setEliminandoAut(null);
    }
  }

  async function eseguiDuplica() {
    if (!duplicaItem) return;
    setDuplicando(true);
    try {
      const prezzoRaw = duplicaItem.prezzo_acquisto || duplicaItem.vcm_valore_medio || '';
      await creaCensimento({
        indirizzo:           duplicaItem.indirizzo || '',
        quartiere:           '',
        tipologia:           duplicaItem.tipologia || '',
        superficie_mq:       duplicaItem.superficie_mq || '',
        prezzo_richiesto:    parsePrezzo(String(prezzoRaw)),
        stato_interesse:     duplicaStato,
        stato_immobile:      duplicaItem.stato_immobile || 'NORMALE',
        venditore:           '',
        note:                '',
        tipo_acquisizione:   'PRIVATO',
        link_riferimento:    '',
        data_inizio_asta:    '',
        // Caratteristiche dalla valutazione
        classe_energetica:   duplicaItem.classe_energetica  || null,
        esposizione:         duplicaItem.esposizione         || null,
        vista:               duplicaItem.vista               || null,
        qualita_costruzione: duplicaItem.qualita_costruzione || null,
        luminosita:          duplicaItem.luminosita          || null,
        stato_conservazione: duplicaItem.stato_conservazione || null,
        fascia_omi:          duplicaItem.fascia_omi          || null,
      });
      console.log('[VALUTAZIONI] Censimento creato OK');
      const idCensito = duplicaItem.id;
      setDuplicaItem(null);
      // Rimuove dalla lista senza navigare via
      setImmobili(prev => prev.filter(i => i.id !== idCensito));
      setCensicitoId(idCensito);
      setTimeout(() => setCensicitoId(null), 3500);
    } catch (err) {
      console.error('[VALUTAZIONI] Errore censisci:', err);
      setDuplicaItem(null);
      setErroreOps(err.response?.data?.error ?? 'Errore durante il salvataggio. Riprova.');
    } finally {
      setDuplicando(false);
    }
  }

  if (loading) return <LoadingSpinner text="Caricamento valutazioni..." />;

  return (
    <div className="flex flex-col gap-4">
      {summary && summary.num_immobili > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Investimento Totale"  value={formatEuro(summary.investimento_totale)}    subtitle="Prezzi di acquisto" />
          <StatCard title="Valore Stimato"        value={formatEuro(summary.valore_stimato_totale)}  subtitle="Stima VCM"
            change={summary.plusvalenza_pct > 0 ? `+${summary.plusvalenza_pct}%` : `${summary.plusvalenza_pct}%`}
            positive={summary.plusvalenza_pct > 0}
          />
          <StatCard title="Canone Mensile"        value={formatEuro(summary.canone_mensile_totale)}  subtitle="Lordo totale" />
          <StatCard title="TIR Medio"             value={formatPct(summary.tir_medio)}               subtitle="Portafoglio" positive={summary.tir_medio > 6} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {immobili.length} valutazioni nel portafoglio
        </p>
        <button
          onClick={() => navigate('/valutazione')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          + Nuova Valutazione
        </button>
      </div>

      {/* Toast censimento avvenuto */}
      {censicitoId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 10, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
            Immobile aggiunto a Censimenti — visibile in "Immobili Censiti".
          </p>
        </div>
      )}

      {immobili.length === 0 ? (
        <EmptyState icon="📊" title="Nessuna valutazione eseguita" message="Usa il Wizard Valutazione per analizzare un immobile e aggiungilo al portafoglio."
          action={<button onClick={() => navigate('/valutazione')} style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Valuta il primo immobile</button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {immobili.map(imm => (
            <CardValutazione
              key={imm.id}
              valutazione={imm}
              rimuovendo={rimuovendo}
              onCensisci={(item) => { setDuplicaItem(item); setDuplicaStato('INTERESSATO'); }}
              onRimuovi={(item) => setConferma({ id: item.id, indirizzo: item.indirizzo })}
            />
          ))}
        </div>
      )}

      {/* ── Sezione: Valutazioni Autonome (da Valuta Tu) ──────────────── */}
      {valAutonome.length > 0 && (
        <div className="flex flex-col gap-3" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Valutazioni Autonome — Valuta Tu</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: 'var(--accent)', fontWeight: 700 }}>{valAutonome.length}</span>
          </div>
          {valAutonome.map(v => {
            const gc = GIUDIZIO_COL[v.giudizio_personale];
            const gl = GIUDIZIO_LABEL[v.giudizio_personale];
            return (
              <div key={v.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
                    {formatAddress(v.indirizzo)}{v.citta ? `, ${v.citta}` : ''}
                  </span>
                  {gl && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: `${gc}22`, color: gc, border: `1px solid ${gc}44` }}>{gl}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                  {v.tipologia && <span>{v.tipologia}</span>}
                  {v.superficie_mq && <span>{formatMq(v.superficie_mq)}</span>}
                  {v.prezzo_richiesto && <span>Richiesto: <b style={{ color: 'var(--text-primary)' }}>{formatEuro(v.prezzo_richiesto)}</b></span>}
                  {v.prezzo_valutato_giusto && <span>Valutato: <b style={{ color: 'var(--accent)' }}>{formatEuro(v.prezzo_valutato_giusto)}</b></span>}
                  {v.rendimento_annuo_stimato_pct && <span>Rendimento: <b style={{ color: '#34d399' }}>{formatPct(v.rendimento_annuo_stimato_pct)}</b></span>}
                </div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 'auto' }}>
                    {formatData(v.data_inserimento)}
                  </span>
                  <button
                    onClick={() => setConfermaAut({ id: v.id, indirizzo: v.indirizzo })}
                    style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    🗑 Elimina
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal conferma rimozione (senza window.confirm) ────────────── */}
      {conferma && (
        <ModalConferma
          icona="🗑"
          titolo="Rimuovi valutazione?"
          messaggio={`Rimuovi "${conferma.indirizzo || 'questo immobile'}" dal portafoglio? La valutazione verrà eliminata.`}
          labelConferma="Rimuovi"
          coloreConferma="rgba(239,68,68,0.9)"
          onConferma={eseguiRimuovi}
          onAnnulla={() => setConferma(null)}
        />
      )}

      {/* ── Modal: aggiungi a Immobili Censiti ────────────────────────── */}
      {duplicaItem && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDuplicaItem(null)} />
          <div className="modal-box modal-box-sm">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Aggiungi a Immobili Censiti</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  {duplicaItem.indirizzo || 'Immobile senza indirizzo'} · {duplicaItem.tipologia}
                </p>
              </div>
              <button className="modal-close" onClick={() => setDuplicaItem(null)}>×</button>
            </div>
            <div className="modal-body-col">
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Scegli categoria di destinazione
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { id: 'COMPRATO',      label: '✓ Acquistati',      color: '#34d399', bg: 'rgba(16,185,129,0.1)' },
                    { id: 'INTERESSATO',   label: '◎ Interessanti',    color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' },
                    { id: 'CEDUTO', label: '→ Ceduto', color: '#f87171', bg: 'rgba(239,68,68,0.1)'  },
                  ].map(opt => (
                    <label key={opt.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, cursor: 'pointer', background: duplicaStato === opt.id ? opt.bg : 'var(--bg-secondary)', border: `1px solid ${duplicaStato === opt.id ? opt.color + '66' : 'var(--border)'}`, transition: 'all 0.12s' }}>
                      <input type="radio" name="stato_duplica" value={opt.id} checked={duplicaStato === opt.id} onChange={() => setDuplicaStato(opt.id)} style={{ accentColor: opt.color, width: 16, height: 16 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: duplicaStato === opt.id ? opt.color : 'var(--text-secondary)' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setDuplicaItem(null)} className="btn-touch"
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer' }}>
                  Annulla
                </button>
                <button onClick={eseguiDuplica} disabled={duplicando} className="btn-touch"
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--accent)', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: duplicando ? 0.5 : 1 }}>
                  {duplicando ? 'Salvataggio…' : 'Aggiungi →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal conferma elimina valutazione autonoma ────────────────── */}
      {confermaAut && (
        <ModalConferma
          icona="🗑"
          titolo="Elimina valutazione?"
          messaggio={`Elimina la valutazione di "${confermaAut.indirizzo || 'questo immobile'}"? L'azione non è reversibile.`}
          labelConferma="Elimina"
          coloreConferma="rgba(239,68,68,0.9)"
          onConferma={eseguiEliminaAut}
          onAnnulla={() => setConfermaAut(null)}
        />
      )}

      {/* ── Modal errore generico ─────────────────────────────────────── */}
      {erroreOps && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setErroreOps(null)} />
          <div className="modal-box modal-box-sm" style={{ border: '1px solid rgba(239,68,68,0.35)' }}>
            <div className="modal-confirm-body">
              <span style={{ fontSize: 52, lineHeight: 1, display: 'block' }}>🚫</span>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginBottom: 8, letterSpacing: '-0.02em' }}>
                  OPS! Qualcosa è andato storto
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{erroreOps}</p>
              </div>
              <button onClick={() => setErroreOps(null)} className="btn-touch"
                style={{ padding: '11px 32px', borderRadius: 10, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer' }}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function MieiInvestimenti() {
  const [searchParams] = useSearchParams();
  const tabIniziale = searchParams.get('tab') || 'tutti';
  const [tabAttiva, setTabAttiva] = useState(tabIniziale);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>I Miei Investimenti</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Gestisci il tuo portafoglio immobiliare</p>
      </div>

      <TabSelector attiva={tabAttiva} onCambio={setTabAttiva} />

      {tabAttiva === 'tutti'       && <CensimentiTab />}
      {tabAttiva === 'locazioni'   && <LocazioniTab />}
      {tabAttiva === 'valutazioni' && <ValutazioniTab />}
    </div>
  );
}
