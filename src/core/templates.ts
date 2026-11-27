import { salesDemo } from "../fixtures/salesDemo";
import type { ImpactId, SalesData } from "./types";

/**
 * A single 1-click what-if adjustment for interactive demos.
 * Contributors can add presets to any template without touching React code.
 */
export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  edits: readonly { regionId: string; current: number }[];
  /** Impact to highlight automatically so source cells light up on click. */
  highlightImpactId?: ImpactId;
}

/**
 * Self-contained scenario template registered in the core layer.
 * Every template reuses the exact same SalesData validation, metrics, impact
 * diffing, reporting, chart and export pipeline.
 */
export interface ScenarioTemplate {
  id: string;
  name: string;
  summary: string;
  data: SalesData;
  presets: readonly ScenarioPreset[];
}

const budgetDemo: SalesData = {
  regions: [
    { id: "region-1", name: "研发部", previous: 180, current: 185, previousCell: "B2", currentCell: "C2" },
    { id: "region-2", name: "市场部", previous: 120, current: 132, previousCell: "B3", currentCell: "C3" },
    { id: "region-3", name: "运营部", previous: 90, current: 86, previousCell: "B4", currentCell: "C4" },
    { id: "region-4", name: "交付部", previous: 110, current: 108, previousCell: "B5", currentCell: "C5" },
  ],
};

const revenueDemo: SalesData = {
  regions: [
    { id: "region-1", name: "SaaS 订阅", previous: 210, current: 245, previousCell: "B2", currentCell: "C2" },
    { id: "region-2", name: "企业私有化", previous: 150, current: 160, previousCell: "B3", currentCell: "C3" },
    { id: "region-3", name: "专业服务", previous: 85, current: 92, previousCell: "B4", currentCell: "C4" },
    { id: "region-4", name: "生态插件", previous: 40, current: 58, previousCell: "B5", currentCell: "C5" },
  ],
};

export const SCENARIO_TEMPLATES: readonly ScenarioTemplate[] = [
  {
    id: "sales",
    name: "区域销售同比",
    summary: "对比各区域上期与本期销售额（万元）",
    data: salesDemo,
    presets: [
      {
        id: "sales-east-drop",
        label: "模拟华东下滑 25%（第一名易主）",
        description: "将华东当前值从 120 调整为 90，观察总额、增长率与排名翻转",
        edits: [{ regionId: "region-1", current: 90 }],
        highlightImpactId: "topRegionId",
      },
      {
        id: "sales-north-surge",
        label: "模拟华北翻倍冲刺",
        description: "将华北当前值从 80 调整为 150，跃升为第一区域",
        edits: [{ regionId: "region-3", current: 150 }],
        highlightImpactId: "topRegionId",
      },
    ],
  },
  {
    id: "budget",
    name: "部门预算执行",
    summary: "对比各部门预算基线与实际支出（万元）",
    data: budgetDemo,
    presets: [
      {
        id: "budget-marketing-overrun",
        label: "模拟市场部追加投放（支出领跑）",
        description: "将市场部当前支出调整为 195，反超研发部并推高整体增速",
        edits: [{ regionId: "region-2", current: 195 }],
        highlightImpactId: "topRegionId",
      },
    ],
  },
  {
    id: "revenue",
    name: "产品线季度营收",
    summary: "对比各业务线上季与本季营收（万元）",
    data: revenueDemo,
    presets: [
      {
        id: "revenue-private-delay",
        label: "模拟私有化大单延期 -40%",
        description: "将企业私有化本季营收调整为 96，查看对整体增长率的冲击",
        edits: [{ regionId: "region-2", current: 96 }],
        highlightImpactId: "growthRate",
      },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = SCENARIO_TEMPLATES[0].id;

export function getScenarioTemplate(id: string): ScenarioTemplate {
  return SCENARIO_TEMPLATES.find((template) => template.id === id) ?? SCENARIO_TEMPLATES[0];
}

/** Produce a new draft with the preset's edits applied; inputs are never mutated. */
export function applyScenarioPreset(baseline: SalesData, preset: ScenarioPreset): SalesData {
  const next = structuredClone(baseline);
  for (const edit of preset.edits) {
    if (!Number.isFinite(edit.current) || edit.current < 0) continue;
    const target = next.regions.find((region) => region.id === edit.regionId);
    if (target) target.current = edit.current;
  }
  return next;
}
