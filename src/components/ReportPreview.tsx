import type { ReportModel } from "../core/types";

interface ReportPreviewProps {
  baselineReport: ReportModel;
  draftReport: ReportModel;
  sourceCells: string[];
}

export function ReportPreview({ baselineReport, draftReport, sourceCells }: ReportPreviewProps) {
  const highlight = (cells: string[]) =>
    sourceCells.length > 0 && cells.some((cell) => sourceCells.includes(cell)) ? "source-report" : "";

  return (
    <section className="panel" aria-labelledby="report-preview-title">
      <h2 id="report-preview-title">报告预览</h2>
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
