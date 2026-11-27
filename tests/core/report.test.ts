import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { computeMetrics } from "../../src/core/metrics";
import { buildReport, formatReportMarkdown } from "../../src/core/report";

describe("buildReport", () => {
  it("builds deterministic report blocks with evidence", () => {
    const report = buildReport(salesDemo, computeMetrics(salesDemo));
    expect(report.blocks.map((block) => block.text)).toEqual([
      "当前总销售额为 300 万元。",
      "同比增长率为 20.00%。",
      "华东销售额最高。",
    ]);
    expect(report.blocks[0].sourceCells).toEqual(["C2", "C3", "C4"]);
  });

  it("keeps the confirmed title and stable block ids", () => {
    const report = buildReport(salesDemo, computeMetrics(salesDemo));
    expect(report.title).toBe("销售数据修改影响报告");
    expect(report.blocks.map((block) => block.id)).toEqual(["summary", "growthNarrative", "leaderNarrative"]);
  });

  it("derives growth evidence from both previous and current cells", () => {
    const report = buildReport(salesDemo, computeMetrics(salesDemo));
    expect(report.blocks[1].sourceCells).toEqual(["B2", "B3", "B4", "C2", "C3", "C4"]);
    expect(report.blocks[2].sourceCells).toEqual(["C2"]);
  });

  it("uses the explicit placeholder when growth is undefined", () => {
    const zero = { regions: [{ ...salesDemo.regions[0], previous: 0, current: 50 }] };
    const report = buildReport(zero, computeMetrics(zero));
    expect(report.blocks[1].text).toBe("同比增长率为 不适用。");
  });

  it("uses the fallback narrative when there is no leading region", () => {
    const empty = { regions: [{ ...salesDemo.regions[0], previous: 0, current: 0 }] };
    const report = buildReport(empty, computeMetrics(empty));
    expect(report.blocks[2].text).toBe("暂无销售额第一区域。");
    expect(report.blocks[2].sourceCells).toEqual(["C2"]);
  });

  it("formats floating-point sums without IEEE-754 noise", () => {
    const decimals = {
      regions: [
        { ...salesDemo.regions[0], previous: 0.1, current: 0.1 },
        { ...salesDemo.regions[1], previous: 0.2, current: 0.2 },
      ],
    };
    const report = buildReport(decimals, computeMetrics(decimals));
    expect(report.blocks[0].text).toBe("当前总销售额为 0.3 万元。");
  });

  it("renders deterministic Markdown summaries for baseline and draft exports", () => {
    const report = buildReport(salesDemo, computeMetrics(salesDemo));
    const confirmedMd = formatReportMarkdown(salesDemo, report, "baseline");
    expect(confirmedMd).toContain("# 销售数据修改影响报告");
    expect(confirmedMd).toContain("版本：已确认版");
    expect(confirmedMd).toContain("| 华东 | 100 | 120 | B2 / C2 |");

    const draftMd = formatReportMarkdown(salesDemo, report, "draft");
    expect(draftMd).toContain("版本：草稿版（含未应用修改）");
  });
});
