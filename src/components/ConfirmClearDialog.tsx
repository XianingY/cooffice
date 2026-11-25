import { Dialog } from "./Dialog";

interface ConfirmClearDialogProps {
  open: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmClearDialog({ open, onCancel, onConfirm }: ConfirmClearDialogProps) {
  if (!open) return null;

  return (
    <Dialog labelledBy="clear-dialog-title" describedBy="clear-dialog-description" onClose={onCancel}>
      <h2 id="clear-dialog-title">清除本地项目？</h2>
      <p id="clear-dialog-description">
        这将删除浏览器中保存的草稿并恢复虚构示例数据。此操作无法撤销，但不会覆盖你的原始 Excel 文件。
      </p>
      <div className="dialog-actions">
        <button type="button" data-autofocus onClick={onCancel}>
          取消
        </button>
        <button type="button" className="danger" onClick={onConfirm}>
          确认清除
        </button>
      </div>
    </Dialog>
  );
}
