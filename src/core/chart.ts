import type { ChartModel, SalesData } from "./types";

/** Deterministic bar-chart data: one bar per region in import order. */
export function buildChart(data: SalesData): ChartModel {
  return {
    title: "各区域当前销售额",
    unit: "万元",
    data: data.regions.map((region) => ({
      regionId: region.id,
      name: region.name,
      value: region.current,
    })),
  };
}
