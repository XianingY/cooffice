import type { ReportModel } from "../core/types";

interface ReportPreviewProps {
  baselineReport: ReportModel;
  draftReport: ReportModel;
  sourceCells: string[];
  onCopyMarkdown?(): void;
  copiedMarkdown?: boolean;
}

export function ReportPreview({
  baselineReport,
  draftReport,
  sourceCells,
  onCopyMarkdown,
  copiedMarkdown = false,
}: ReportPreviewProps) {
  const highlight = (cells: string[]) =>
    sourceCells.length > 0 && cells.some((cell) => sourceCells.includes(cell)) ? "source-report" : "";

  return (
    <section className="panel" aria-labelledby="report-preview-title">
      <div className="panel-header-row">
        <h2 id="report-preview-title">报告预览</h2>
        {onCopyMarkdown ? (
          <button type="button" className="copy-md-button" onClick={onCopyMarkdown}>
            {copiedMarkdown ? "已复制 Markdown" : "复制 Markdown"}
          </button>
        ) : null}
      </div>
      <div className="report-grid">
        <article aria-label="原始报告">
          <h3>原始报告（已确认）</h3>
          {baselineReport.blocks.map((block) => (
            <p key={block.id} className={highlight(block.sourceCells)}>
              {block.text}
            </p>
          ))}
        </article>
        <article role="region" aria-label="草稿报告">
          <h3>草稿报告</h3>
          {draftReport.blocks.map((block) => (
            <p key={block.id} className={highlight(block.sourceCells)}>
              {block.text}
            </p>
          ))}
        </article>
      </div>
      <p className="hint">点击影响项可同时高亮来源单元格与关联报告块。</p>
    </section>
  );
}
