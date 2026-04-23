/**
 * EmptyState — stato vuoto elegante
 */
export default function EmptyState({ icon = '📭', title = 'Nessun dato', message, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '64px 24px',
      textAlign: 'center',
    }}>
      {/* Icona con sfondo */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        marginBottom: 4,
      }}>
        {icon}
      </div>

      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {title}
        </h3>
        {message && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.6 }}>
            {message}
          </p>
        )}
      </div>

      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
