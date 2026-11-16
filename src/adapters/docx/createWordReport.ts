import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import type { ReportModel, SalesData } from "../../core/types";

/**
 * Word export from the confirmed baseline and its deterministic ReportModel.
 * The caller decides which snapshot to pass; this adapter never reads draft
 * state and never contacts a server.
 */
export async function createWordReport(data: SalesData, report: ReportModel): Promise<Blob> {
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
    new Paragraph({ text: "说明：本文件内容来自已确认版本，不包含未应用草稿。" }),
  ];

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
