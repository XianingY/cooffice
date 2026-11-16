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

/** Configurable report block order (v0.3.0). */
export interface ReportConfig {
  blocks: ReportBlockId[];
}

/** A single bar in the deterministic region chart (v0.3.0). */
export interface ChartDatum {
  regionId: string;
  name: string;
  value: number;
}

/** Deterministic chart model derived from confirmed or draft data. */
export interface ChartModel {
  title: string;
  unit: string;
  data: ChartDatum[];
}

/** Portable project document. v3 adds the report config (v0.3.0). */
export interface ProjectFileSnapshot {
  schemaVersion: 3;
  format: "what-if-report-project";
  baseline: SalesData;
  draft: SalesData;
  updatedAt: string;
  config: ReportConfig;
}
