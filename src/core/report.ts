import { formatAmount, formatGrowth } from "./format";
import { planReportBlocks } from "./reportConfig";
import type { Metrics, ReportBlock, ReportBlockId, ReportConfig, ReportModel, SalesData } from "./types";

/**
 * Deterministic Chinese report model. No AI, no randomness and no date/time
 * input, so the same data and config always render the same text. When no
 * config is supplied the original three-block report is produced, which keeps
 * v0.1/v0.2 callers (including compareSnapshots) fully backward compatible.
 */
export function buildReport(
  data: SalesData,
  metrics: Metrics,
  config?: ReportConfig,
): ReportModel {
  const currentCells = data.regions.map((region) => region.currentCell);
  const previousCells = data.regions.map((region) => region.previousCell);
  const leader = data.regions.find((region) => region.id === metrics.topRegionId);

  const all: Record<ReportBlockId, ReportBlock> = {
    summary: {
      id: "summary",
      text: `当前总销售额为 ${formatAmount(metrics.totalCurrent)} 万元。`,
      sourceCells: currentCells,
    },
    growthNarrative: {
      id: "growthNarrative",
      text: `同比增长率为 ${formatGrowth(metrics.growthRate)}。`,
      sourceCells: [...previousCells, ...currentCells],
    },
    leaderNarrative: {
      id: "leaderNarrative",
      text: leader ? `${leader.name}销售额最高。` : "暂无销售额第一区域。",
      sourceCells: leader ? [leader.currentCell] : currentCells,
    },
  };

  const order = config ? planReportBlocks(config) : (["summary", "growthNarrative", "leaderNarrative"] as ReportBlockId[]);
  return {
    title: "销售数据修改影响报告",
    blocks: order.map((id) => all[id]),
  };
}

/**
 * Render a deterministic Markdown summary for quick pasting into PRs, wikis,
 * chat or email without any third-party formatter dependency.
 */
export function formatReportMarkdown(
  data: SalesData,
  report: ReportModel,
  source: "baseline" | "draft" = "baseline",
): string {
  const badge = source === "draft" ? "草稿版（含未应用修改）" : "已确认版";
  const lines: string[] = [
    `# ${report.title}`,
    "",
    `> 版本：${badge}`,
    "",
    "## 核心结论",
    "",
    ...report.blocks.map((block) => `- ${block.text}`),
    "",
    "## 数据明细（万元）",
    "",
    "| 区域 | 上期 | 当前 | 来源单元格 |",
    "|---|---:|---:|---|",
    ...data.regions.map(
      (region) =>
        `| ${region.name} | ${formatAmount(region.previous)} | ${formatAmount(region.current)} | ${region.previousCell} / ${region.currentCell} |`,
    ),
  ];
  return lines.join("\n");
}
