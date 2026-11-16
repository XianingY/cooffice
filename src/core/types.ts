/** Shared, framework-agnostic domain contracts for the What-if Report core. */

export interface SalesRegion {
  id: string;
  name: string;
  previous: number;
  current: number;
  previousCell: string;
  currentCell: string;
}

export interface SalesData {
  regions: SalesRegion[];
}

export interface Metrics {
  totalCurrent: number;
  totalPrevious: number;
  growthRate: number | null;
  topRegionId: string | null;
}

export type ImpactId =
  | "totalCurrent"
  | "growthRate"
  | "topRegionId"
  | "summary"
  | "growthNarrative"
  | "leaderNarrative";

export type ImpactKind = "metric" | "ranking" | "narrative";

export interface Impact {
  id: ImpactId;
  kind: ImpactKind;
  label: string;
  before: string;
  after: string;
  sourceCells: string[];
}

export type ReportBlockId = "summary" | "growthNarrative" | "leaderNarrative";

export interface ReportBlock {
  id: ReportBlockId;
  text: string;
  sourceCells: string[];
}

export interface ReportModel {
  title: "销售数据修改影响报告";
  blocks: ReportBlock[];
}

export interface ProjectSnapshot {
  schemaVersion: 1;
  baseline: SalesData;
  draft: SalesData;
  updatedAt: string;
}

/** A source-agnostic table produced by the CSV adapter (v0.2.0). */
export interface TabularInput {
  headers: string[];
  rows: string[][];
  source: "csv";
}

/** User-confirmed mapping from table columns to the three required fields. */
export interface ColumnMapping {
  region: number;
  previous: number;
  current: number;
}
