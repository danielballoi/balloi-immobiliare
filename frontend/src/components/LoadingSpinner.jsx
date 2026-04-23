/**
 * LoadingSpinner — spinner di caricamento minimal
 */
export default function LoadingSpinner({ text = 'Caricamento...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '64px 24px',
    }}>
      {/* Ring spinner */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2px solid var(--border-strong)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
        {text}
      </span>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
