interface ToolbarProps {
  hasUnappliedDraft: boolean;
  onApply(): void;
  onRevert(): void;
  onClear(): void;
  onExportExcel?(): void;
  onExportWord?(): void;
  onExportProject?(): void;
  onImportProject?(file: File): void;
}

export function Toolbar({
  hasUnappliedDraft,
  onApply,
  onRevert,
  onClear,
  onExportExcel,
  onExportWord,
  onExportProject,
  onImportProject,
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
      {onExportProject ? (
        <button type="button" onClick={onExportProject}>
          导出项目文件
        </button>
      ) : null}
      {onImportProject ? (
        <label className="button-link" htmlFor="project-file">
          导入项目文件
          <input
            id="project-file"
            className="visually-hidden-input"
            type="file"
            accept=".json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) onImportProject(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}
      <button type="button" onClick={onClear}>
        清除本地项目
      </button>
    </div>
  );
}
