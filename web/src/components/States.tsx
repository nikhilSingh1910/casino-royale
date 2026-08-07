export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ padding: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton" style={{ height: 34, marginBottom: 8 }} key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ icon = '🏏', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="state">
      <div className="state__icon">{icon}</div>
      <div className="state__title">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <div className="state__icon">⚠️</div>
      <div className="state__title">{title}</div>
      {message && <div>{message}</div>}
      {onRetry && (
        <button className="btn-link" style={{ marginTop: 12 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
