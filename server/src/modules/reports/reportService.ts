import type { ProjectService } from "../projects/projectService.js";
import type { ReportConfig, SalesData } from "../types.js";

export interface Metrics {
  totalCurrent: number;
  totalPrevious: number;
  growthRate: number | null;
  topRegionId: string | null;
}

export interface ReportBlock {
  id: string;
  text: string;
  sourceCells: string[];
}

/** Server-owned deterministic calculations — the API is authoritative. */
export function computeMetrics(data: SalesData): Metrics {
  const totalCurrent = data.regions.reduce((sum, region) => sum + region.current, 0);
  const totalPrevious = data.regions.reduce((sum, region) => sum + region.previous, 0);
  const leader = data.regions.reduce<SalesData["regions"][number] | undefined>(
    (best, region) => (!best || region.current > best.current ? region : best),
    undefined,
  );
  return {
    totalCurrent,
    totalPrevious,
    growthRate: totalPrevious > 0 ? (totalCurrent - totalPrevious) / totalPrevious : null,
    topRegionId: totalCurrent > 0 ? (leader?.id ?? null) : null,
  };
}

function formatAmount(value: number): string {
  const rounded = Number(value.toFixed(10));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function formatGrowth(value: number | null): string {
  return value === null ? "不适用" : `${(value * 100).toFixed(2)}%`;
}

export function buildReport(data: SalesData, config: ReportConfig): ReportBlock[] {
  const metrics = computeMetrics(data);
  const currentCells = data.regions.map((region) => region.currentCell);
  const previousCells = data.regions.map((region) => region.previousCell);
  const leader = data.regions.find((region) => region.id === metrics.topRegionId);
  const all: Record<string, ReportBlock> = {
    summary: { id: "summary", text: `当前总销售额为 ${formatAmount(metrics.totalCurrent)} 万元。`, sourceCells: currentCells },
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
  const seen = new Set<string>();
  const ordered: ReportBlock[] = [];
  for (const id of config.blocks) {
    if (id in all && !seen.has(id)) {
      seen.add(id);
      ordered.push(all[id]);
    }
  }
  return ordered;
}

export function buildChart(data: SalesData) {
  return {
    title: "各区域当前销售额",
    unit: "万元",
    data: data.regions.map((region) => ({ regionId: region.id, name: region.name, value: region.current })),
  };
}

/** ReportService reads confirmed data only by default; draft is opt-in. */
export class ReportService {
  constructor(private readonly projects: ProjectService) {}

  generate(ownerId: string, projectId: string, useDraft: boolean) {
    const project = this.projects.get(ownerId, projectId);
    const data = useDraft ? project.draft : project.baseline;
    const metrics = computeMetrics(data);
    return {
      projectId,
      basis: useDraft ? "draft" : "baseline",
      metrics,
      blocks: buildReport(data, project.config),
      chart: buildChart(data),
      generatedAt: new Date().toISOString(),
    };
  }

  analytics(ownerId: string, projectId: string) {
    const project = this.projects.get(ownerId, projectId);
    return {
      confirmed: computeMetrics(project.baseline),
      draft: computeMetrics(project.draft),
      chart: buildChart(project.draft),
      hasUnappliedChanges: JSON.stringify(project.baseline) !== JSON.stringify(project.draft),
    };
  }
}
