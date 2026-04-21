/**
 * MieiInvestimenti - Pagina portafoglio immobiliare
 *
 * Mostra tutti gli immobili salvati nel portafoglio con:
 *   - KPI aggregati (investimento totale, valore stimato, TIR medio, canone totale)
 *   - Tabella dettagliata degli immobili
 *   - Azioni: rimuovi dal portafoglio, vai alla valutazione originale
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPortafoglio, getSummaryPortafoglio, rimuoviDaPortafoglio } from '../services/api';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const formatEuro = (n) =>
  n ? `€ ${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : '–';
const formatPct = (n) =>
  n != null ? `${Number(n).toFixed(1)}%` : '–';
const formatData = (iso) =>
  iso ? new Date(iso).toLocaleDateString('it-IT') : '–';

export default function MieiInvestimenti() {
  const navigate = useNavigate();
  const [immobili, setImmobili]   = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [rimuovendo, setRimuovendo] = useState(null);

  // ── Caricamento dati portafoglio ───────────────────────────────────
  const caricaDati = () => {
    console.log('[PORTAFOGLIO] Caricamento portafoglio');
    setLoading(true);
    Promise.all([getPortafoglio(), getSummaryPortafoglio()])
      .then(([lista, sum]) => {
        console.log(`[PORTAFOGLIO] ${lista.length} immobili, summary caricato`);
        setImmobili(lista);
        setSummary(sum);
      })
      .catch(err => console.error('[PORTAFOGLIO] Errore caricamento:', err))
      .finally(() => setLoading(false));
  };
  useEffect(caricaDati, []);

  // ── Rimozione immobile ─────────────────────────────────────────────
  const rimuovi = async (id, indirizzo) => {
    if (!window.confirm(`Rimuovere "${indirizzo || 'questo immobile'}" dal portafoglio?`)) return;
    setRimuovendo(id);
    console.log(`[PORTAFOGLIO] Rimozione immobile ID: ${id}`);
    try {
      await rimuoviDaPortafoglio(id);
      caricaDati();
    } catch (err) {
      console.error('[PORTAFOGLIO] Errore rimozione:', err);
    } finally {
      setRimuovendo(null);
    }
  };

  if (loading) return <LoadingSpinner text="Caricamento portafoglio..." />;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Intestazione ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>I Miei Investimenti</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Portafoglio immobiliare · {immobili.length} immobili</p>
        </div>
        <button
          onClick={() => navigate('/valutazione')}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          + Aggiungi Immobile
        </button>
      </div>

      {/* ── KPI aggregati ────────────────────────────────────────────── */}
      {summary && summary.num_immobili > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Investimento Totale"
            value={formatEuro(summary.investimento_totale)}
            subtitle="Prezzi di acquisto"
          />
          <StatCard
            title="Valore Stimato"
            value={formatEuro(summary.valore_stimato_totale)}
            subtitle="Stima VCM"
            change={summary.plusvalenza_pct > 0 ? `+${summary.plusvalenza_pct}%` : `${summary.plusvalenza_pct}%`}
            positive={summary.plusvalenza_pct > 0}
          />
          <StatCard
            title="Canone Mensile"
            value={formatEuro(summary.canone_mensile_totale)}
            subtitle="Lordo totale"
          />
          <StatCard
            title="TIR Medio"
            value={formatPct(summary.tir_medio)}
            subtitle="Portafoglio"
            positive={summary.tir_medio > 6}
          />
        </div>
      )}

      {/* ── Lista immobili ───────────────────────────────────────────── */}
      {immobili.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="Nessun immobile in portafoglio"
          message="Aggiungi immobili dal Wizard Valutazione per tracciarne le performance."
          action={
            <button
              onClick={() => navigate('/valutazione')}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              Valuta il primo immobile
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {immobili.map(imm => (
            <div
              key={imm.id}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Info principale */}
                <div className="flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {imm.indirizzo || 'Indirizzo non specificato'}
                    </h3>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent)' }}
                    >
                      {imm.zona_codice}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {imm.tipologia} · {imm.superficie_mq} mq · {imm.stato_immobile}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Inserito il {formatData(imm.data_inserimento)}
                  </p>
                </div>

                {/* KPI principali */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Acquisto</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{formatEuro(imm.prezzo_acquisto)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Valore Stimato</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--accent)' }}>{formatEuro(imm.vcm_valore_medio)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Canone/mese</p>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{formatEuro(imm.canone_mensile)}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>TIR</p>
                    <p
                      className="font-semibold text-sm"
                      style={{ color: imm.tir_pct > 6 ? 'var(--success)' : imm.tir_pct ? 'var(--warning)' : 'var(--text-muted)' }}
                    >
                      {formatPct(imm.tir_pct)}
                    </p>
                  </div>
                </div>

                {/* Azioni */}
                <div className="flex sm:flex-col gap-2 justify-end items-end">
                  <button
                    onClick={() => rimuovi(imm.id, imm.indirizzo)}
                    disabled={rimuovendo === imm.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    {rimuovendo === imm.id ? '...' : 'Rimuovi'}
                  </button>
                  {imm.van != null && (
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        background: imm.van > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: imm.van > 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      VAN {formatEuro(imm.van)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
