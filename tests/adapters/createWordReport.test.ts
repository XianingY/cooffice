import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { computeMetrics } from "../../src/core/metrics";
import { buildReport } from "../../src/core/report";
import { createWordReport } from "../../src/adapters/docx/createWordReport";
import { salesDemo } from "../../src/fixtures/salesDemo";

const confirmedReport = () => buildReport(salesDemo, computeMetrics(salesDemo));

// jsdom's Blob does not implement arrayBuffer(); browsers do. Read the same
// bytes through FileReader so the content assertions stay unchanged.
const readBlobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe("createWordReport", () => {
  it("creates a non-empty Word blob from the confirmed report", async () => {
    const blob = await createWordReport(salesDemo, confirmedReport());
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("wordprocessingml");
  });

  it("embeds the title, generation time, report text and source notes", async () => {
    const blob = await createWordReport(salesDemo, confirmedReport());
    const entries = unzipSync(await readBlobBytes(blob));
    const documentXml = strFromU8(entries["word/document.xml"]).replace(/<[^>]+>/g, "");

    expect(documentXml).toContain("销售数据修改影响报告");
    expect(documentXml).toContain("生成时间：");
    expect(documentXml).toContain("当前总销售额为 300 万元。");
    expect(documentXml).toContain("同比增长率为 20.00%。");
    expect(documentXml).toContain("华东销售额最高。");
    expect(documentXml).toContain("华东：previous=B2，current=C2");
    expect(documentXml).toContain("华北：previous=B4，current=C4");
  });

  it("renders the draft report text and accurate draft disclaimer when exporting a draft", async () => {
    const draft = structuredClone(salesDemo);
    draft.regions[0].current = 90;
    const blob = await createWordReport(draft, buildReport(draft, computeMetrics(draft)), "draft");
    const entries = unzipSync(await readBlobBytes(blob));
    const documentXml = strFromU8(entries["word/document.xml"]).replace(/<[^>]+>/g, "");

    expect(documentXml).toContain("当前总销售额为 270 万元。");
    expect(documentXml).not.toContain("当前总销售额为 300 万元。");
    expect(documentXml).toContain("草稿版本");
    expect(documentXml).not.toContain("不包含未应用草稿");
  });
});
