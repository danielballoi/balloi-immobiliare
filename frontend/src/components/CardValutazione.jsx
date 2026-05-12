import { useState } from 'react';

const formatEuro = (n) =>
  n != null && !isNaN(n) ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';
const formatPct = (n) =>
  n != null && !isNaN(n) ? `${Number(n).toFixed(1)}%` : '–';
const formatData = (iso) =>
  iso ? new Date(iso).toLocaleDateString('it-IT') : '–';

const FASCIA_COLOR = {
  ALTA:  'var(--success)',
  MEDIA: 'var(--accent)',
  BASSA: 'var(--text-muted)',
};

export default function CardValutazione({ valutazione, onRimuovi, onCensisci, rimuovendo }) {
  const [sezione, setSezione] = useState(null);
  const v = valutazione;

  const hasVCM = v.vcm_valore_medio != null;
  const hasRED = v.red_valore_mercato != null;
  const hasDCF = v.dcf_van != null;
  const fasciaColor = FASCIA_COLOR[v.fascia_omi] ?? 'var(--text-muted)';

  const toggle = (id) => setSezione(s => s === id ? null : id);

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.indirizzo || '–'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {[v.tipologia, v.superficie_mq ? `${Math.round(v.superficie_mq)} mq` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {v.fascia_omi && (
            <span style={{ padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: `${fasciaColor}20`, color: fasciaColor, border: `1px solid ${fasciaColor}40` }}>
              Fascia {v.fascia_omi}
            </span>
          )}
          {v.dcf_van != null && (
            <span style={{ padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: v.dcf_van > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: v.dcf_van > 0 ? 'var(--success)' : 'var(--danger)' }}>
              VAN {formatEuro(v.dcf_van)}
            </span>
          )}
        </div>
      </div>

      {/* ── Caratteristiche ── */}
      {(v.classe_energetica || v.esposizione || v.vista) && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {[
              { label: 'Classe energ.', val: v.classe_energetica },
              { label: 'Esposizione',   val: v.esposizione },
              { label: 'Vista',         val: v.vista },
              { label: 'Qualità',       val: v.qualita_costruzione },
              { label: 'Luminosità',    val: v.luminosita },
              { label: 'Stato',         val: v.stato_conservazione },
            ].filter(x => x.val).map(({ label, val: vl }) => (
              <div key={label}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 1 }}>{label}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{vl}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sezioni espandibili ── */}
      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {hasVCM && (
          <details open={sezione === 'vcm'} onToggle={e => e.target.open ? setSezione('vcm') : setSezione(null)}>
            <summary style={{
              padding: '10px 14px', borderRadius: 9, background: 'var(--bg-secondary)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)',
              listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              userSelect: 'none',
            }}>
              <span>Valutazione Comparativa (VCM)</span>
              <span style={{ fontSize: 15 }}>{sezione === 'vcm' ? '−' : '+'}</span>
            </summary>
            <div style={{ padding: '14px', background: 'rgba(245,158,11,0.04)', borderRadius: 9, marginTop: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'Minimo',  val: v.vcm_valore_min,   accent: false },
                  { label: 'Medio',   val: v.vcm_valore_medio, accent: true  },
                  { label: 'Massimo', val: v.vcm_valore_max,   accent: false },
                ].map(({ label, val: vl, accent }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: accent ? 17 : 14, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {formatEuro(vl)}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Prezzo base <strong>{formatEuro(v.vcm_prezzo_base_mq)}/mq</strong>
                {v.fascia_omi && <> · Fascia <strong style={{ color: fasciaColor }}>{v.fascia_omi}</strong></>}
                {v.vcm_punti_alti != null && <> · {v.vcm_punti_alti}/6 caratteristiche alte</>}
              </p>
            </div>
          </details>
        )}

        {hasRED && (
          <details open={sezione === 'red'} onToggle={e => e.target.open ? setSezione('red') : setSezione(null)}>
            <summary style={{
              padding: '10px 14px', borderRadius: 9, background: 'var(--bg-secondary)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#3b82f6',
              listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              userSelect: 'none',
            }}>
              <span>Analisi Reddituale</span>
              <span style={{ fontSize: 15 }}>{sezione === 'red' ? '−' : '+'}</span>
            </summary>
            <div style={{ padding: '14px', background: 'rgba(59,130,246,0.04)', borderRadius: 9, marginTop: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Valore di Mercato',  val: formatEuro(v.red_valore_mercato), color: '#3b82f6' },
                  { label: 'NOI Annuo',           val: formatEuro(v.red_noi_annuo),       color: 'var(--text-primary)' },
                  { label: 'Rendimento Lordo',    val: formatPct(v.red_rendimento_lordo_pct),  color: 'var(--success)' },
                  { label: 'Rendimento Netto',    val: formatPct(v.red_rendimento_netto_pct),  color: 'var(--text-primary)' },
                ].map(({ label, val: vl, color }) => (
                  <div key={label}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color }}>{vl}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        {hasDCF && (
          <details open={sezione === 'dcf'} onToggle={e => e.target.open ? setSezione('dcf') : setSezione(null)}>
            <summary style={{
              padding: '10px 14px', borderRadius: 9, background: 'var(--bg-secondary)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--success)',
              listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              userSelect: 'none',
            }}>
              <span>Analisi Finanziaria (DCF)</span>
              <span style={{ fontSize: 15 }}>{sezione === 'dcf' ? '−' : '+'}</span>
            </summary>
            <div style={{ padding: '14px', background: 'rgba(16,185,129,0.04)', borderRadius: 9, marginTop: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'VAN (NPV)', val: formatEuro(v.dcf_van), color: v.dcf_van > 0 ? 'var(--success)' : 'var(--danger)' },
                  { label: 'TIR (IRR)', val: formatPct(v.dcf_tir_pct), color: 'var(--success)' },
                  { label: 'ROI Totale', val: formatPct(v.dcf_roi_totale_pct), color: 'var(--text-primary)' },
                  { label: 'Cash-on-Cash', val: formatPct(v.dcf_cash_on_cash_pct), color: 'var(--text-primary)' },
                ].map(({ label, val: vl, color }) => (
                  <div key={label}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color }}>{vl}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* ── Footer: data + azioni ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {formatData(v.data_inserimento)}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {onCensisci && (
            <button onClick={() => onCensisci(v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Censisci
            </button>
          )}
          {onRimuovi && (
            <button onClick={() => onRimuovi(v)} disabled={rimuovendo === v.id}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {rimuovendo === v.id ? '…' : 'Rimuovi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
