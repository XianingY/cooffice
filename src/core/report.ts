import { formatGrowth } from "./format";
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
      text: `当前总销售额为 ${metrics.totalCurrent} 万元。`,
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
