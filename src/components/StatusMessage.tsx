interface StatusMessageProps {
  error?: string;
  exportError?: string;
  notice?: string;
}

/** Import/export failures use role=alert; non-blocking notices use role=status. */
export function StatusMessage({ error, exportError, notice }: StatusMessageProps) {
  return (
    <div className="status-messages" aria-live="polite">
      {error ? (
        <p role="alert" className="status-error">
          {error}
        </p>
      ) : null}
      {exportError ? (
        <p role="alert" className="status-error">
          {exportError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="status-notice">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
