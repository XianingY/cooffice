import type { Metrics, SalesData, SalesRegion } from "./types";

/**
 * Deterministic metric derivation from the confirmed design spec (section 5).
 * Pure TypeScript: no React, DOM, file-format or storage dependencies.
 */
export function computeMetrics(data: SalesData): Metrics {
  let totalCurrent = 0;
  let totalPrevious = 0;
  let leader: SalesRegion | undefined;

  for (const region of data.regions) {
    totalCurrent += region.current;
    totalPrevious += region.previous;
    // Strict ">" keeps the first region of the import order on ties.
    if (region.current > (leader?.current ?? -Infinity)) {
      leader = region;
    }
  }

  return {
    totalCurrent,
    totalPrevious,
    growthRate: totalPrevious > 0 ? (totalCurrent - totalPrevious) / totalPrevious : null,
    topRegionId: totalCurrent > 0 ? (leader?.id ?? null) : null,
  };
}
