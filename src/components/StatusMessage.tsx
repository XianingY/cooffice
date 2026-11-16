interface StatusMessageProps {
  error?: string;
  exportError?: string;
  notices?: string[];
}

/**
 * Import/export failures use role=alert and notices use role=status. Each
 * message owns its own live region, so a polite wrapper does not downgrade
 * urgent import errors, and aria-atomic keeps the whole sentence readable.
 */
export function StatusMessage({ error, exportError, notices = [] }: StatusMessageProps) {
  return (
    <div className="status-messages">
      {error ? (
        <p role="alert" aria-atomic="true" className="status-error">
          <span className="status-prefix">导入失败：</span>
          {error}
        </p>
      ) : null}
      {exportError ? (
        <p role="alert" aria-atomic="true" className="status-error">
          {exportError}
        </p>
      ) : null}
      {notices.map((text) => (
        <p key={text} role="status" aria-atomic="true" className="status-notice">
          {text}
        </p>
      ))}
    </div>
  );
}
