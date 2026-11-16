interface ToolbarProps {
  hasUnappliedDraft: boolean;
  onApply(): void;
  onRevert(): void;
  onClear(): void;
  onExportExcel?(): void;
  onExportWord?(): void;
}

export function Toolbar({
  hasUnappliedDraft,
  onApply,
  onRevert,
  onClear,
  onExportExcel,
  onExportWord,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="项目操作">
      <a className="button-link" href="templates/sales-template.xlsx" download="sales-template.xlsx">
        下载模板
      </a>
      <a className="button-link" href="templates/sales-demo.xlsx" download="sales-demo.xlsx">
        下载示例
      </a>
      <button type="button" className="primary" onClick={onApply} disabled={!hasUnappliedDraft}>
        应用修改
      </button>
      <button type="button" onClick={onRevert} disabled={!hasUnappliedDraft}>
        撤销草稿
      </button>
      {onExportExcel ? (
        <button type="button" onClick={onExportExcel}>
          导出 Excel
        </button>
      ) : null}
      {onExportWord ? (
        <button type="button" onClick={onExportWord}>
          导出 Word
        </button>
      ) : null}
      <button type="button" onClick={onClear}>
        清除本地项目
      </button>
    </div>
  );
}
