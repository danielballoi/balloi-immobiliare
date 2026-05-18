/**
 * LegittimitaSection — Visualizzazione + editing inline dello stato di legittimità
 * Usata in DettaglioImmobile (MieiInvestimenti).
 *
 * Tre stati visivi:
 *   has_abusi = null/undefined → giallo dashed  (non specificato)
 *   has_abusi = 0 / false      → verde          (pienamente legittimo)
 *   has_abusi = 1 / true       → rosso          (abusi segnalati)
 *
 * Props:
 *   imm       {object}   — il censimento (ha .has_abusi e .descrizione_abusi)
 *   onSalvato {fn(data)} — callback con { has_abusi, descrizione_abusi }
 */

import { useState } from 'react';
import LegittimitaInput from './LegittimitaInput';

const SEZIONE_STYLE = {
  abusi: {
    background: 'rgba(220,38,38,0.1)', border: '2px solid #DC2626',
    borderRadius: 8, padding: 16, marginBottom: 16,
  },
  legittimo: {
    background: 'rgba(34,197,94,0.08)', border: '1px solid #22C55E',
    borderRadius: 8, padding: 16, marginBottom: 16,
  },
  non_specificato: {
    background: 'rgba(234,179,8,0.08)', border: '1px dashed #EAB308',
    borderRadius: 8, padding: 16, marginBottom: 16,
  },
};

export default function LegittimitaSection({ imm, onSalvato }) {
  const [editing, setEditing]           = useState(false);
  const [editHasAbusi, setEditHasAbusi] = useState(null);
  const [editDescr, setEditDescr]       = useState('');
  const [expanded, setExpanded]         = useState(false);
  const [errori, setErrori]             = useState({});

  const hasAbusi = imm.has_abusi;

  function apriEdit() {
    setEditHasAbusi(hasAbusi === 1 ? true : hasAbusi === 0 ? false : null);
    setEditDescr(imm.descrizione_abusi || '');
    setErrori({});
    setEditing(true);
  }

  function annulla() {
    setEditing(false);
    setErrori({});
  }

  function salva() {
    const e = {};
    if (editHasAbusi === null) {
      e.has_abusi = 'Seleziona uno stato';
    }
    if (editHasAbusi === true && (!editDescr || editDescr.trim().length < 10)) {
      e.descrizione_abusi = 'Descrizione obbligatoria (min 10 caratteri)';
    }
    if (Object.keys(e).length > 0) { setErrori(e); return; }

    onSalvato({
      has_abusi:          editHasAbusi ? 1 : 0,
      descrizione_abusi:  editHasAbusi ? editDescr.trim() : null,
    });
    setEditing(false);
  }

  const BtnModifica = () => (
    <button
      onClick={apriEdit}
      style={{
        background: 'transparent', border: 'none',
        color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0,
      }}
    >
      ✏ Modifica
    </button>
  );

  if (editing) {
    return (
      <div style={SEZIONE_STYLE.non_specificato}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
          Stato Legittimità — Modifica
        </p>
        <LegittimitaInput
          value={editHasAbusi}
          descrizione={editDescr}
          onChange={setEditHasAbusi}
          onDescrizioneChange={setEditDescr}
          errori={errori}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            onClick={salva}
            style={{
              padding: '8px 20px', borderRadius: 8, background: 'var(--accent)',
              color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}
          >
            Salva
          </button>
          <button
            onClick={annulla}
            style={{
              padding: '8px 16px', borderRadius: 8, background: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            Annulla
          </button>
        </div>
      </div>
    );
  }

  if (hasAbusi === 1 || hasAbusi === true) {
    return (
      <div style={SEZIONE_STYLE.abusi}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
            🚨 ATTENZIONE — Abusi / Difformità segnalati
          </p>
          <BtnModifica />
        </div>
        {imm.descrizione_abusi && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                fontSize: 12, color: '#ef4444', background: 'transparent',
                border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {expanded ? '▼ Nascondi descrizione' : '▶ Visualizza descrizione abusi ›'}
            </button>
            {expanded && (
              <div style={{
                marginTop: 8, padding: '10px 14px', borderRadius: 6,
                background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
              }}>
                <p style={{
                  fontSize: 13, color: 'var(--text-primary)',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0,
                }}>
                  {imm.descrizione_abusi}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (hasAbusi === 0 || hasAbusi === false) {
    return (
      <div style={SEZIONE_STYLE.legittimo}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
            ✅ Immobile pienamente legittimo
          </p>
          <BtnModifica />
        </div>
      </div>
    );
  }

  // Stato non specificato (null / undefined)
  return (
    <div style={SEZIONE_STYLE.non_specificato}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: '#ca8a04' }}>
          ⚠️ Stato di legittimità non specificato
        </p>
        <button
          onClick={apriEdit}
          style={{
            padding: '5px 14px', borderRadius: 6, background: '#eab308',
            color: '#000', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          Compila ora
        </button>
      </div>
    </div>
  );
}
