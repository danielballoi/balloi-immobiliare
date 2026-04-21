/** Spinner di caricamento centrato - usato mentre aspettiamo dati dall'API */
export default function LoadingSpinner({ text = 'Caricamento...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      {/* Cerchio animato con border-top colorato */}
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
      />
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}
