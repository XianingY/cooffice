import { useEffect, useRef } from "react";

interface ConfirmImportDialogProps {
  open: boolean;
  /** File name when known from a native dialog or a drop; omitted for inline input. */
  fileName?: string;
  onCancel(): void;
  onConfirm(): void;
}

/**
 * Shared guard for every import route (file input, drag/drop, native dialog).
 * Importing replaces both the confirmed baseline and the draft, so accidental
 * drops must not silently destroy work.
 */
export function ConfirmImportDialog({ open, fileName, onCancel, onConfirm }: ConfirmImportDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-description"
        className="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 id="import-dialog-title">替换当前项目？</h2>
        <p id="import-dialog-description">
          {fileName ? `导入「${fileName}」会` : "导入新文件会"}
          覆盖当前已确认数据和草稿，此操作无法撤销。你的原始文件不会被修改。
        </p>
        <div className="dialog-actions">
          <button type="button" ref={cancelRef} onClick={onCancel}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
