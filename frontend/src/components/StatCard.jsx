/**
 * StatCard - Card KPI riutilizzabile
 *
 * Mostra una metrica con: titolo, valore principale, variazione % e sottotitolo.
 * Componente "presentazionale": riceve tutto tramite props, nessuna logica interna.
 *
 * Props:
 *   title    - string: nome della metrica (uppercase piccolo)
 *   value    - string|number: valore principale (grande e in grassetto)
 *   change   - string: variazione, es "+3.2%" (opzionale)
 *   positive - bool: true = verde, false = rosso (per change e valore trend)
 *   icon     - ReactNode: icona SVG opzionale
 *   subtitle - string: testo piccolo sotto il valore (opzionale)
 */

export default function StatCard({ title, value, change, positive, icon, subtitle }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      }}
    >
      {/* Riga superiore: titolo + icona opzionale */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          {title}
        </span>
        {icon && (
          <span style={{ color: 'var(--accent)' }}>{icon}</span>
        )}
      </div>

      {/* Valore principale — grande e prominente */}
      <div
        className="text-2xl font-bold leading-none"
        style={{ color: positive === false ? 'var(--danger)' : positive ? 'var(--success)' : 'var(--text-primary)' }}
      >
        {value ?? '–'}
      </div>

      {/* Riga inferiore: sottotitolo + badge variazione */}
      <div className="flex items-center justify-between gap-2">
        {subtitle && (
          <span className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
        {change && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
            style={{
              background: positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: positive ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
