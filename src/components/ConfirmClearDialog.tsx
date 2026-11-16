import { useEffect, useRef } from "react";

interface ConfirmClearDialogProps {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmClearDialog({ open, onCancel, onConfirm }: ConfirmClearDialogProps) {
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
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-description"
        className="dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 id="clear-dialog-title">清除本地项目？</h2>
        <p id="clear-dialog-description">
          这将删除浏览器中保存的草稿并恢复虚构示例数据。此操作无法撤销，但不会覆盖你的原始 Excel 文件。
        </p>
        <div className="dialog-actions">
          <button type="button" ref={cancelRef} onClick={onCancel}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            确认清除
          </button>
        </div>
      </div>
    </div>
  );
}
