/**
 * EmptyState - Stato vuoto generico
 * Mostrato quando una lista non ha risultati.
 *
 * Props:
 *   icon    - string: emoji o icona
 *   title   - string: titolo messaggio
 *   message - string: descrizione
 *   action  - ReactNode: pulsante azione opzionale
 */
export default function EmptyState({ icon = '📭', title = 'Nessun dato', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {message && <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
