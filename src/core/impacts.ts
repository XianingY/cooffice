import { formatAmount, formatGrowth } from "./format";
import { computeMetrics } from "./metrics";
import { buildReport } from "./report";
import type { Impact, ImpactId, ImpactKind, ReportBlockId, SalesData } from "./types";

const NARRATIVE_LABELS: Record<ReportBlockId, string> = {
  summary: "总额结论",
  growthNarrative: "增长率结论",
  leaderNarrative: "排名结论",
};

/**
 * Compare the confirmed baseline with the draft and describe every visible
 * change. Only changed display values produce an Impact; inputs are never
 * mutated and the result order is stable for UI rendering and tests.
 */
export function compareSnapshots(baseline: SalesData, draft: SalesData): Impact[] {
  const before = computeMetrics(baseline);
  const after = computeMetrics(draft);
  const beforeReport = buildReport(baseline, before);
  const afterReport = buildReport(draft, after);
  const impacts: Impact[] = [];

  const add = (
    id: ImpactId,
    kind: ImpactKind,
    label: string,
    beforeText: string,
    afterText: string,
    sourceCells: string[],
  ): void => {
    if (beforeText !== afterText) {
      impacts.push({ id, kind, label, before: beforeText, after: afterText, sourceCells });
    }
  };

  const currentCells = draft.regions.map((region) => region.currentCell);
  const previousCells = draft.regions.map((region) => region.previousCell);
  const beforeLeader = baseline.regions.find((region) => region.id === before.topRegionId);
  const afterLeader = draft.regions.find((region) => region.id === after.topRegionId);

  add(
    "totalCurrent",
    "metric",
    "总销售额",
    `${formatAmount(before.totalCurrent)} 万元`,
    `${formatAmount(after.totalCurrent)} 万元`,
    currentCells,
  );
  add(
    "growthRate",
    "metric",
    "同比增长率",
    formatGrowth(before.growthRate),
    formatGrowth(after.growthRate),
    [...previousCells, ...currentCells],
  );
  add(
    "topRegionId",
    "ranking",
    "第一区域",
    beforeLeader?.name ?? "无",
    afterLeader?.name ?? "无",
    [...new Set([...(beforeLeader ? [beforeLeader.currentCell] : []), ...(afterLeader ? [afterLeader.currentCell] : [])])],
  );

  for (const beforeBlock of beforeReport.blocks) {
    const afterBlock = afterReport.blocks.find((block) => block.id === beforeBlock.id)!;
    add(
      beforeBlock.id,
      "narrative",
      NARRATIVE_LABELS[beforeBlock.id],
      beforeBlock.text,
      afterBlock.text,
      afterBlock.sourceCells,
    );
  }

  return impacts;
}
