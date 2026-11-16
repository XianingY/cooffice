interface StatusMessageProps {
  error?: string;
  exportError?: string;
  notices?: string[];
}

/** Import/export failures use role=alert; non-blocking notices use role=status. */
export function StatusMessage({ error, exportError, notices = [] }: StatusMessageProps) {
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
      {notices.map((text) => (
        <p key={text} role="status" className="status-notice">
          {text}
        </p>
      ))}
    </div>
  );
}
