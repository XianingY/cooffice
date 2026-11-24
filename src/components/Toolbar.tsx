import type { ThemeSetting } from "../desktop/bridge";

export type ExportSource = "baseline" | "draft";

export const EXPORT_SOURCE_LABELS: Record<ExportSource, string> = {
  baseline: "已确认版",
  draft: "草稿版",
};

export const THEME_LABELS: Record<ThemeSetting, string> = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};

interface ToolbarProps {
  hasUnappliedDraft: boolean;
  onApply(): void;
  onRevert(): void;
  onClear(): void;
  onExportExcel?(): void;
  onExportWord?(): void;
  /** Which snapshot the Excel/Word buttons export. */
  exportSource?: ExportSource;
  onExportSourceChange?(source: ExportSource): void;
  onExportProject?(): void;
  onImportProject?(file: File): void;
  /** Present in the desktop shell: opens the native file dialog instead. */
  onOpenProjectFromDisk?(): void;
  theme?: ThemeSetting;
  onCycleTheme?(): void;
}

export function Toolbar({
  hasUnappliedDraft,
  onApply,
  onRevert,
  onClear,
  onExportExcel,
  onExportWord,
  exportSource = "baseline",
  onExportSourceChange,
  onExportProject,
  onImportProject,
  onOpenProjectFromDisk,
  theme,
  onCycleTheme,
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
      {onExportSourceChange && (onExportExcel || onExportWord) ? (
        <fieldset className="export-source">
          <legend className="sr-only">导出来源</legend>
          {(["baseline", "draft"] as const).map((source) => (
            <label key={source} htmlFor={`export-source-${source}`}>
              <input
                id={`export-source-${source}`}
                type="radio"
                name="export-source"
                value={source}
                checked={exportSource === source}
                onChange={() => onExportSourceChange(source)}
              />
              {EXPORT_SOURCE_LABELS[source]}
            </label>
          ))}
        </fieldset>
      ) : null}
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
      {onOpenProjectFromDisk ? (
        <button type="button" onClick={onOpenProjectFromDisk}>
          打开项目文件
        </button>
      ) : onImportProject ? (
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
      {onCycleTheme ? (
        <button type="button" onClick={onCycleTheme} aria-label="切换主题">
          主题：{theme ? THEME_LABELS[theme] : THEME_LABELS.system}
        </button>
      ) : null}
    </div>
  );
}
