import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import type { ReportModel, SalesData } from "../../core/types";

export type WordExportSource = "baseline" | "draft";

/**
 * Word export from the selected snapshot (baseline by default, or draft when
 * explicitly chosen in the toolbar) and its deterministic ReportModel.
 */
export async function createWordReport(
  data: SalesData,
  report: ReportModel,
  source: WordExportSource = "baseline",
): Promise<Blob> {
  const footerNote =
    source === "draft"
      ? "说明：本文件内容来自草稿版本，包含尚未应用的修改。"
      : "说明：本文件内容来自已确认版本，不包含未应用草稿。";

  const children = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: `生成时间：${new Date().toISOString()}` }),
    new Paragraph({ text: "指标摘要", heading: HeadingLevel.HEADING_1 }),
    ...report.blocks.map((block) => new Paragraph({ text: block.text })),
    new Paragraph({ text: "数据来源", heading: HeadingLevel.HEADING_1 }),
    ...data.regions.map(
      (region) =>
        new Paragraph({
          text: `${region.name}：previous=${region.previousCell}，current=${region.currentCell}`,
        }),
    ),
    new Paragraph({ text: footerNote }),
  ];

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
