/**
 * StatCard — KPI card component
 * Design: Stripe-inspired, clean metric card
 */

export default function StatCard({ title, value, change, positive, icon, subtitle }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Glow accent top-left */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'linear-gradient(90deg, var(--accent) 0%, transparent 60%)',
        opacity: 0.4,
      }} />

      {/* Header: titolo + icona */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          {title}
        </span>
        {icon && (
          <span style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
            fontSize: 14,
          }}>
            {icon}
          </span>
        )}
      </div>

      {/* Valore principale */}
      <div style={{
        fontSize: 26,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        color: positive === false ? 'var(--danger)'
          : positive ? 'var(--success)'
          : 'var(--text-primary)',
      }}>
        {value ?? '–'}
      </div>

      {/* Footer: sottotitolo + badge variazione */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {subtitle && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            {subtitle}
          </span>
        )}
        {change && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 20,
            background: positive ? 'var(--success-dim)' : 'var(--danger-dim)',
            color: positive ? 'var(--success)' : 'var(--danger)',
            flexShrink: 0,
          }}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
