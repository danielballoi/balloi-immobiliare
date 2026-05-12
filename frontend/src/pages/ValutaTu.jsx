/**
 * ValutaTu — Wizard 3 step per valutazione autonoma di un immobile
 *
 * Step 1: Dati immobile (indirizzo, tipologia, superficie, ecc.)
 * Step 2: Caratteristiche & prezzo (classe energetica, esposizione, ecc.)
 * Step 3: La tua valutazione (prezzo giusto, rendita, giudizio, ecc.)
 *
 * Al termine salva in censimenti_immobili con origine='VALUTAZIONE_AUTONOMA'
 * e reindirizza a /portafoglio?tab=valutazioni
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { creaCensimento, searchStrade } from '../services/api';
import { formatVia } from '../components/StradeAutocomplete';

// ── Helpers ──────────────────────────────────────────────────────────────────
const req = (val) => val !== '' && val != null;

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  fontSize: 13,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 6,
  letterSpacing: '0.01em',
};
const errBorder = { borderColor: 'rgba(239,68,68,0.7)' };

const Field = ({ label, obbligatorio, children, errore }) => (
  <div>
    <label style={labelStyle}>
      {label}{obbligatorio && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
    </label>
    {children}
    {errore && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠ {errore}</p>}
  </div>
);

// ── Dati iniziali form ────────────────────────────────────────────────────────
const FORM_INIT = {
  // Step 1
  indirizzo: '', quartiere: '', citta: 'Cagliari', cap: '',
  link_zona: null, // codice zona OMI dalla strade_cagliari, usato per riferimenti OMI
  tipologia: '', superficie_mq: '', piano: '',
  num_locali: '', num_bagni: '', anno_costruzione: '', stato_immobile: 'Buono',
  url_annuncio: '',
  // Step 2
  prezzo_richiesto: '', classe_energetica: 'Non specificata',
  esposizione: 'Standard', vista: 'Standard',
  spese_condominiali_mensili: '', rendita_catastale: '',
  box_auto: false, giardino: false, balcone_terrazza: false, ascensore: false,
  // Step 3
  prezzo_valutato_giusto: '', rendita_mensile_stimata: '',
  rendimento_annuo_stimato_pct: '',
  giudizio_personale: 'Interessante',
  fascia_omi: 'MEDIA',
  note: '',
  stato_interesse: 'INTERESSATO',
};

// ── STEP 1 ────────────────────────────────────────────────────────────────────
function Step1({ form, setForm, errori }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [acRisultati, setAcRisultati] = useState([]);
  const [acAperto, setAcAperto] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAcAperto(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const onIndirizzoChange = (v) => {
    upd('indirizzo', v);
    clearTimeout(debounceRef.current);
    if (v.length < 2) { setAcAperto(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchStrade(v);
        setAcRisultati(res || []);
        setAcAperto((res || []).length > 0);
      } catch { setAcAperto(false); }
    }, 300);
  };

  const onSeleziona = (item) => {
    upd('indirizzo', formatVia(item.via));
    if (item.quartiere) upd('quartiere', item.quartiere);
    if (item.link_zona) upd('link_zona', item.link_zona);
    setAcAperto(false);
    setAcRisultati([]);
  };

  const tipologie = [
    'Appartamento', 'Villa', 'Monolocale', 'Bilocale', 'Trilocale',
    'Quadrilocale', 'Abitazione economica', 'Ufficio', 'Negozio',
    'Garage', 'Terreno', 'Altro',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Indirizzo" obbligatorio errore={errori.indirizzo}>
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <input value={form.indirizzo} onChange={e => onIndirizzoChange(e.target.value)}
            placeholder="Via Roma, 12"
            style={{ ...inputStyle, ...(errori.indirizzo ? errBorder : {}) }} />
          {acAperto && acRisultati.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, marginTop: 4, overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)', maxHeight: 220, overflowY: 'auto',
            }}>
              {acRisultati.map((item, i) => (
                <div key={i}
                  onMouseDown={() => onSeleziona(item)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                    color: 'var(--text-primary)', background: 'transparent',
                    borderBottom: i < acRisultati.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 600 }}>{formatVia(item.via)}</span>
                  {item.quartiere && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>{item.quartiere}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Quartiere">
          <input value={form.quartiere} onChange={e => upd('quartiere', e.target.value)}
            placeholder="Es. Villanova" style={inputStyle} />
        </Field>
        <Field label="CAP">
          <input value={form.cap} onChange={e => upd('cap', e.target.value)}
            placeholder="Es. 09100" style={inputStyle} />
        </Field>
        <Field label="Tipologia" obbligatorio errore={errori.tipologia}>
          <select value={form.tipologia} onChange={e => upd('tipologia', e.target.value)}
            style={{ ...inputStyle, ...(errori.tipologia ? errBorder : {}) }}>
            <option value="">-- Seleziona --</option>
            {tipologie.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Superficie (mq)" obbligatorio errore={errori.superficie_mq}>
          <input type="number" min="1" value={form.superficie_mq}
            onChange={e => upd('superficie_mq', e.target.value)}
            placeholder="Es. 80"
            style={{ ...inputStyle, ...(errori.superficie_mq ? errBorder : {}) }} />
        </Field>
        <Field label="Piano">
          <input value={form.piano} onChange={e => upd('piano', e.target.value)}
            placeholder="Es. 2° oppure Terra" style={inputStyle} />
        </Field>
        <Field label="N° Locali">
          <input type="number" min="0" value={form.num_locali}
            onChange={e => upd('num_locali', e.target.value)}
            placeholder="Es. 3" style={inputStyle} />
        </Field>
        <Field label="N° Bagni">
          <input type="number" min="0" value={form.num_bagni}
            onChange={e => upd('num_bagni', e.target.value)}
            placeholder="Es. 1" style={inputStyle} />
        </Field>
        <Field label="Anno di Costruzione">
          <input type="number" min="1800" max="2099" value={form.anno_costruzione}
            onChange={e => upd('anno_costruzione', e.target.value)}
            placeholder="Es. 1985" style={inputStyle} />
        </Field>
        <Field label="Stato Immobile">
          <select value={form.stato_immobile} onChange={e => upd('stato_immobile', e.target.value)} style={inputStyle}>
            <option>Ottimo</option>
            <option>Buono</option>
            <option>Da ristrutturare</option>
            <option>In costruzione</option>
          </select>
        </Field>
      </div>

      <Field label="URL Annuncio">
        <input
          type="url"
          value={form.url_annuncio}
          onChange={e => upd('url_annuncio', e.target.value)}
          placeholder="https://www.immobiliare.it/..."
          style={inputStyle}
        />
      </Field>
    </div>
  );
}

// ── STEP 2 ────────────────────────────────────────────────────────────────────
function Step2({ form, setForm, errori }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Prezzo Richiesto (€)" obbligatorio errore={errori.prezzo_richiesto}>
          <input type="number" min="0" value={form.prezzo_richiesto}
            onChange={e => upd('prezzo_richiesto', e.target.value)}
            placeholder="Es. 250000"
            style={{ ...inputStyle, ...(errori.prezzo_richiesto ? errBorder : {}) }} />
        </Field>
        <Field label="Classe Energetica">
          <select value={form.classe_energetica} onChange={e => upd('classe_energetica', e.target.value)} style={inputStyle}>
            {['A4','A3','A2','A1','B','C','D','E','F','G','Non specificata'].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Esposizione">
          <select value={form.esposizione} onChange={e => upd('esposizione', e.target.value)} style={inputStyle}>
            {['Nord','Sud','Est','Ovest','Nord-Sud','Est-Ovest','Buona','Ottima','Standard'].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Vista">
          <select value={form.vista} onChange={e => upd('vista', e.target.value)} style={inputStyle}>
            {['Panoramica','Giardino','Strada','Cortile','Standard'].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Spese Condominiali/mese (€)">
          <input type="number" min="0" value={form.spese_condominiali_mensili}
            onChange={e => upd('spese_condominiali_mensili', e.target.value)}
            placeholder="Es. 150" style={inputStyle} />
        </Field>
        <Field label="Rendita Catastale (€)">
          <input type="number" min="0" value={form.rendita_catastale}
            onChange={e => upd('rendita_catastale', e.target.value)}
            placeholder="Es. 600" style={inputStyle} />
        </Field>
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Dotazioni
        </p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { field: 'box_auto',         label: 'Box / Garage' },
            { field: 'giardino',         label: 'Giardino' },
            { field: 'balcone_terrazza', label: 'Terrazzo / Balcone' },
            { field: 'ascensore',        label: 'Ascensore' },
          ].map(({ field, label }) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={!!form[field]}
                onChange={e => upd(field, e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── STEP 3 ────────────────────────────────────────────────────────────────────
function Step3({ form, setForm, errori }) {
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Calcola rendimento automaticamente
  useEffect(() => {
    const prezzo = parseFloat(form.prezzo_valutato_giusto);
    const rendita = parseFloat(form.rendita_mensile_stimata);
    if (prezzo > 0 && rendita > 0) {
      const rend = ((rendita * 12) / prezzo * 100).toFixed(2);
      setForm(f => ({ ...f, rendimento_annuo_stimato_pct: rend }));
    }
  }, [form.prezzo_valutato_giusto, form.rendita_mensile_stimata]);

  const giudizi = ['Affare', 'Interessante', 'Nella media', 'Sopravvalutato', 'Da evitare'];
  const giudizioColor = {
    'Affare': '#10b981', 'Interessante': '#f59e0b', 'Nella media': '#94a3b8',
    'Sopravvalutato': '#f97316', 'Da evitare': '#ef4444',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Prezzo giusto */}
      <Field label="Secondo me vale… (€)" obbligatorio errore={errori.prezzo_valutato_giusto}>
        <input type="number" min="0" value={form.prezzo_valutato_giusto}
          onChange={e => upd('prezzo_valutato_giusto', e.target.value)}
          placeholder="Es. 220000"
          style={{ ...inputStyle, ...(errori.prezzo_valutato_giusto ? errBorder : {}) }} />
        {form.prezzo_richiesto && form.prezzo_valutato_giusto && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {parseFloat(form.prezzo_valutato_giusto) < parseFloat(form.prezzo_richiesto)
              ? `Sconto implicito: ${Math.round(100 - (parseFloat(form.prezzo_valutato_giusto) / parseFloat(form.prezzo_richiesto) * 100))}% rispetto al prezzo richiesto`
              : 'Prezzo in linea o superiore al richiesto'}
          </p>
        )}
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Stimo una rendita mensile di… (€)">
          <input type="number" min="0" value={form.rendita_mensile_stimata}
            onChange={e => upd('rendita_mensile_stimata', e.target.value)}
            placeholder="Es. 800" style={inputStyle} />
        </Field>
        <Field label="Rendimento annuo stimato (%)">
          <input type="number" min="0" step="0.01" value={form.rendimento_annuo_stimato_pct}
            onChange={e => upd('rendimento_annuo_stimato_pct', e.target.value)}
            placeholder="Calcolato auto"
            style={{ ...inputStyle, borderColor: 'rgba(245,158,11,0.4)' }} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            Calcolato da rendita × 12 ÷ prezzo valutato
          </p>
        </Field>
      </div>

      {/* Giudizio personale */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Giudizio Personale
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {giudizi.map(g => (
            <button key={g} onClick={() => upd('giudizio_personale', g)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: form.giudizio_personale === g ? giudizioColor[g] + '22' : 'transparent',
                borderColor: form.giudizio_personale === g ? giudizioColor[g] : 'var(--border)',
                color: form.giudizio_personale === g ? giudizioColor[g] : 'var(--text-muted)',
                transition: 'all 0.12s',
              }}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Fascia prezzo */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Fascia di Prezzo Percepita
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {['BASSA', 'MEDIA', 'ALTA'].map(f => {
            const col = { ALTA: 'var(--success)', MEDIA: 'var(--accent)', BASSA: 'var(--text-muted)' }[f];
            return (
              <button key={f} onClick={() => upd('fascia_omi', f)}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', border: '1px solid',
                  background: form.fascia_omi === f ? col + '22' : 'transparent',
                  borderColor: form.fascia_omi === f ? col : 'var(--border)',
                  color: form.fascia_omi === f ? col : 'var(--text-muted)',
                }}>
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Note */}
      <Field label="Appunti e motivazioni…">
        <textarea value={form.note} onChange={e => upd('note', e.target.value.slice(0, 500))}
          rows={4} maxLength={500}
          placeholder="Cosa ti ha convinto? Cosa ti preoccupa? Dettagli del sopralluogo…"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>
          {form.note.length}/500
        </p>
      </Field>

      {/* Stato portafoglio */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Stato nel Portafoglio
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'INTERESSATO',   label: 'Interessante',   color: '#fbbf24' },
            { id: 'COMPRATO',      label: 'Acquistato',     color: '#34d399' },
            { id: 'CEDUTO', label: 'Ceduto', color: '#f87171' },
          ].map(s => (
            <button key={s.id} onClick={() => upd('stato_interesse', s.id)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                background: form.stato_interesse === s.id ? s.color + '22' : 'transparent',
                borderColor: form.stato_interesse === s.id ? s.color : 'var(--border)',
                color: form.stato_interesse === s.id ? s.color : 'var(--text-muted)',
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RIEPILOGO ─────────────────────────────────────────────────────────────────
function Riepilogo({ form }) {
  const formatEuro = (n) => n ? `€ ${Number(n).toLocaleString('it-IT')}` : 'Non specificato';
  const siNo = (v) => v ? 'Sì' : 'No';
  const giudizioColor = {
    'Affare': '#10b981', 'Interessante': '#f59e0b', 'Nella media': '#94a3b8',
    'Sopravvalutato': '#f97316', 'Da evitare': '#ef4444',
  };

  const sezioni = [
    {
      titolo: 'Dati Immobile',
      righe: [
        ['Indirizzo', form.indirizzo || '–'],
        ['Città / CAP', [form.citta, form.cap].filter(Boolean).join(' ') || '–'],
        ['Tipologia', form.tipologia || '–'],
        ['Superficie', form.superficie_mq ? `${form.superficie_mq} mq` : '–'],
        ['Piano', form.piano || '–'],
        ['Locali / Bagni', [form.num_locali ? `${form.num_locali} locali` : null, form.num_bagni ? `${form.num_bagni} bagni` : null].filter(Boolean).join(' / ') || '–'],
        ['Anno costruzione', form.anno_costruzione || '–'],
        ['Stato immobile', form.stato_immobile || '–'],
      ],
    },
    {
      titolo: 'Caratteristiche & Prezzo',
      righe: [
        ['Prezzo richiesto', formatEuro(form.prezzo_richiesto)],
        ['Classe energetica', form.classe_energetica || '–'],
        ['Esposizione', form.esposizione || '–'],
        ['Vista', form.vista || '–'],
        ['Box/Garage', siNo(form.box_auto)],
        ['Giardino', siNo(form.giardino)],
        ['Balcone/Terrazzo', siNo(form.balcone_terrazza)],
        ['Ascensore', siNo(form.ascensore)],
      ],
    },
    {
      titolo: 'La Tua Valutazione',
      righe: [
        ['Prezzo valutato', formatEuro(form.prezzo_valutato_giusto)],
        ['Rendita mensile stimata', form.rendita_mensile_stimata ? `${formatEuro(form.rendita_mensile_stimata)}/mese` : '–'],
        ['Rendimento annuo', form.rendimento_annuo_stimato_pct ? `${form.rendimento_annuo_stimato_pct}%` : '–'],
        ['Giudizio', form.giudizio_personale || '–'],
        ['Fascia prezzo', form.fascia_omi || '–'],
        ['Stato portafoglio', form.stato_interesse === 'COMPRATO' ? 'Acquistato' : form.stato_interesse === 'INTERESSATO' ? 'Interessante' : 'Ceduto'],
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
          Controlla tutti i dati prima di salvare
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          Dopo il salvataggio troverai questa valutazione in "I Miei Investimenti" tab "Valutazioni Eseguite".
        </p>
      </div>

      {/* Badge giudizio */}
      {form.giudizio_personale && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 14, fontWeight: 700,
            background: (giudizioColor[form.giudizio_personale] || '#94a3b8') + '22',
            color: giudizioColor[form.giudizio_personale] || '#94a3b8',
            border: `1px solid ${giudizioColor[form.giudizio_personale] || '#94a3b8'}44`,
          }}>
            {form.giudizio_personale}
          </span>
          {form.rendimento_annuo_stimato_pct && (
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
              {form.rendimento_annuo_stimato_pct}% rendimento
            </span>
          )}
        </div>
      )}

      {sezioni.map(s => (
        <div key={s.titolo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.titolo}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {s.righe.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 14px', background: i % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-card)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 120, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {form.note && (
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Note</p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{form.note}</p>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPALE ─────────────────────────────────────────────────────
export default function ValutaTu() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=Step1, 1=Step2, 2=Step3, 3=Riepilogo
  const [form, setForm] = useState(FORM_INIT);
  const [errori, setErrori] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);

  const STEP_LABELS = ['Dati Immobile', 'Caratteristiche', 'Valutazione', 'Riepilogo'];

  function validaStep(s) {
    const e = {};
    if (s === 0) {
      if (!form.indirizzo.trim()) e.indirizzo = 'Campo obbligatorio';
      if (!form.tipologia) e.tipologia = 'Seleziona la tipologia';
      if (!form.superficie_mq) e.superficie_mq = 'Campo obbligatorio';
    }
    if (s === 1) {
      if (!form.prezzo_richiesto) e.prezzo_richiesto = 'Campo obbligatorio';
    }
    if (s === 2) {
      if (!form.prezzo_valutato_giusto) e.prezzo_valutato_giusto = 'Campo obbligatorio';
    }
    setErrori(e);
    return Object.keys(e).length === 0;
  }

  function avanti() {
    if (!validaStep(step)) return;
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function indietro() {
    setStep(s => s - 1);
    setErrori({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salva() {
    setSalvando(true);
    try {
      await creaCensimento({
        indirizzo:         form.indirizzo,
        quartiere:         form.quartiere || null,
        citta:             form.citta || null,
        cap:               form.cap || null,
        tipologia:         form.tipologia,
        superficie_mq:     form.superficie_mq || null,
        piano:             form.piano || null,
        num_locali:        form.num_locali || null,
        num_bagni:         form.num_bagni || null,
        anno_costruzione:  form.anno_costruzione || null,
        stato_immobile:    form.stato_immobile,
        prezzo_richiesto:  form.prezzo_richiesto || null,
        classe_energetica: form.classe_energetica !== 'Non specificata' ? form.classe_energetica : null,
        esposizione:       form.esposizione !== 'Standard' ? form.esposizione : null,
        vista:             form.vista !== 'Standard' ? form.vista : null,
        spese_condominiali_mensili: form.spese_condominiali_mensili || null,
        rendita_catastale: form.rendita_catastale || null,
        box_auto:          form.box_auto ? 1 : 0,
        giardino:          form.giardino ? 1 : 0,
        balcone_terrazza:  form.balcone_terrazza ? 1 : 0,
        ascensore:         form.ascensore ? 1 : 0,
        prezzo_valutato_giusto:     form.prezzo_valutato_giusto || null,
        rendita_mensile_stimata:    form.rendita_mensile_stimata || null,
        rendimento_annuo_stimato_pct: form.rendimento_annuo_stimato_pct || null,
        giudizio_personale: form.giudizio_personale || null,
        fascia_omi:         form.fascia_omi || null,
        note:               form.note || null,
        url_annuncio:       form.url_annuncio || null,
        stato_interesse:    form.stato_interesse,
        origine:            'VALUTAZIONE_AUTONOMA',
        tipo_acquisizione:  null,
      });
      setToast('Valutazione salvata con successo!');
      setTimeout(() => navigate('/portafoglio?tab=valutazioni'), 1500);
    } catch (err) {
      console.error('[VALUTA TU] Errore salvataggio:', err);
      setToast('Errore durante il salvataggio. Riprova.');
      setSalvando(false);
    }
  }

  const progressPct = ((step) / (STEP_LABELS.length - 1)) * 100;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Valuta Tu
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          Inserisci i dati di un immobile e aggiungi la tua valutazione personale
        </p>
      </div>

      {/* Progress bar + step labels */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {STEP_LABELS.map((label, i) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STEP_LABELS.length - 1 ? 'flex-end' : 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, marginBottom: 4,
                background: i <= step ? 'var(--accent)' : 'var(--bg-secondary)',
                color: i <= step ? '#000' : 'var(--text-muted)',
                border: i === step ? '2px solid var(--accent)' : '2px solid var(--border)',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: i === step ? 'var(--accent)' : 'var(--text-muted)', fontWeight: i === step ? 700 : 400, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.includes('Errore') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${toast.includes('Errore') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          color: toast.includes('Errore') ? 'var(--danger)' : 'var(--success)',
        }}>
          {toast.includes('Errore') ? '⚠' : '✓'} {toast}
        </div>
      )}

      {/* Step content */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: '24px 28px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          Step {step + 1} — {STEP_LABELS[step]}
        </h2>

        {step === 0 && <Step1 form={form} setForm={setForm} errori={errori} />}
        {step === 1 && <Step2 form={form} setForm={setForm} errori={errori} />}
        {step === 2 && <Step3 form={form} setForm={setForm} errori={errori} />}
        {step === 3 && <Riepilogo form={form} />}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 32 }}>
        <button
          onClick={step === 0 ? () => navigate('/portafoglio') : indietro}
          style={{
            padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            border: '1px solid var(--border)', cursor: 'pointer',
          }}>
          {step === 0 ? '← Annulla' : '← Indietro'}
        </button>

        {step < 3 ? (
          <button onClick={avanti}
            style={{
              padding: '12px 32px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer',
            }}>
            Avanti →
          </button>
        ) : (
          <button onClick={salva} disabled={salvando}
            style={{
              padding: '12px 32px', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: salvando ? 'var(--bg-secondary)' : 'var(--accent)',
              color: salvando ? 'var(--text-muted)' : '#000',
              border: 'none', cursor: salvando ? 'not-allowed' : 'pointer',
              opacity: salvando ? 0.7 : 1,
            }}>
            {salvando ? 'Salvataggio…' : '💾 Salva in I Miei Investimenti'}
          </button>
        )}
      </div>
    </div>
  );
}
