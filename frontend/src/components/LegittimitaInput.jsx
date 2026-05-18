/**
 * LegittimitaInput — Campo riusabile "Stato Legittimità / Abusi"
 *
 * Props:
 *   value              {boolean|null}  — null=non risposto, false=NO, true=SÌ abusi
 *   descrizione        {string}        — testo libero della descrizione abusi
 *   onChange           {fn(bool)}      — callback cambio scelta SÌ/NO
 *   onDescrizioneChange{fn(string)}    — callback cambio textarea
 *   errori             {object}        — { has_abusi?, descrizione_abusi? }
 */
export default function LegittimitaInput({ value, descrizione = '', onChange, onDescrizioneChange, errori = {} }) {
  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 13,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
    resize: 'vertical', lineHeight: 1.6,
  };

  return (
    <div>
      <p style={{
        fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
      }}>
        Stato Legittimità / Abusi *
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: errori.has_abusi ? 8 : 14, flexWrap: 'wrap' }}>
        {[
          { v: false, label: '✅ NO — Pienamente legittimo',          color: '#22c55e' },
          { v: true,  label: '🚨 SÌ — Presenza abusi / difformità',  color: '#ef4444' },
        ].map(opt => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            style={{
              flex: 1, minWidth: 160, padding: '11px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${value === opt.v ? opt.color : 'var(--border)'}`,
              background: value === opt.v ? opt.color + '1a' : 'transparent',
              color: value === opt.v ? opt.color : 'var(--text-muted)',
              transition: 'all 0.12s', textAlign: 'left',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {errori.has_abusi && (
        <p style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 10 }}>⚠ {errori.has_abusi}</p>
      )}

      {value === true && (
        <div>
          <label style={{
            display: 'block', fontSize: 12, fontWeight: 600,
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            Descrivi gli abusi o le difformità riscontrate *
          </label>
          <textarea
            value={descrizione}
            onChange={e => onDescrizioneChange(e.target.value)}
            rows={4}
            placeholder="Es. Veranda chiusa non sanata di 8 mq, ampliamento non autorizzato al piano terra, cambio di destinazione d'uso non comunicato, divisione interna non a catasto…"
            style={{
              ...inputStyle,
              borderColor: errori.descrizione_abusi ? 'rgba(239,68,68,0.7)' : 'rgba(239,68,68,0.35)',
            }}
          />
          {errori.descrizione_abusi && (
            <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠ {errori.descrizione_abusi}</p>
          )}
        </div>
      )}
    </div>
  );
}
