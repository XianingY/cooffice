import { applyColumnMapping } from "../../core/columnMapping";
import { buildChart } from "../../core/chart";
import { compareSnapshots } from "../../core/impacts";
import { computeMetrics } from "../../core/metrics";
import { buildReport } from "../../core/report";
import type {
  ChartModel,
  ColumnMapping,
  Impact,
  Metrics,
  ReportModel,
  SalesData,
  TabularInput,
} from "../../core/types";

/**
 * Minimal host adapter for validating WPS add-in feasibility (v0.5.0).
 * It owns no calculations: every model is produced by the same core functions
 * the web app uses. No WPS-specific runtime dependency is introduced, and the
 * adapter never writes back to or covers the host workbook.
 */
export interface WpsPreview {
  data: SalesData;
  metrics: Metrics;
  impacts: Impact[];
  report: ReportModel;
  chart: ChartModel;
}

export function createWpsPreview(table: TabularInput, mapping: ColumnMapping): WpsPreview {
  const data = applyColumnMapping(table, mapping);
  const metrics = computeMetrics(data);
  return {
    data,
    metrics,
    impacts: compareSnapshots(data, data),
    report: buildReport(data, metrics),
    chart: buildChart(data),
  };
}

/** Capability boundaries recorded in docs/wps-integration-notes.md. */
export const WPS_CAPABILITY_MATRIX = {
  readActiveSheet: true,
  showTextPreview: true,
  reuseCore: true,
  writeBackToWorkbook: false,
  networkCalls: false,
  verifiedOnRealClient: false,
} as const;
