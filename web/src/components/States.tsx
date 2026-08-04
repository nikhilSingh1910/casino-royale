export function LoadingCards({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="card" key={i}>
          <div className="card__body">
            <div className="skeleton" style={{ height: 20, width: '45%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 44 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
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
        <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
