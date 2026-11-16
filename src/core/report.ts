import { formatGrowth } from "./format";
import type { Metrics, ReportModel, SalesData } from "./types";

/**
 * Deterministic Chinese report model. No AI, no randomness and no date/time
 * input, so the same data always renders the same text.
 */
export function buildReport(data: SalesData, metrics: Metrics): ReportModel {
  const currentCells = data.regions.map((region) => region.currentCell);
  const previousCells = data.regions.map((region) => region.previousCell);
  const leader = data.regions.find((region) => region.id === metrics.topRegionId);

  return {
    title: "销售数据修改影响报告",
    blocks: [
      {
        id: "summary",
        text: `当前总销售额为 ${metrics.totalCurrent} 万元。`,
        sourceCells: currentCells,
      },
      {
        id: "growthNarrative",
        text: `同比增长率为 ${formatGrowth(metrics.growthRate)}。`,
        sourceCells: [...previousCells, ...currentCells],
      },
      {
        id: "leaderNarrative",
        text: leader ? `${leader.name}销售额最高。` : "暂无销售额第一区域。",
        sourceCells: leader ? [leader.currentCell] : currentCells,
      },
    ],
  };
}
