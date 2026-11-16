import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { computeMetrics } from "../../src/core/metrics";
import { formatGrowth } from "../../src/core/format";

const edit = (current: number) => ({
  regions: salesDemo.regions.map((region, index) => (index === 0 ? { ...region, current } : { ...region })),
});

const single = (previous: number, current: number) => ({
  regions: [{ ...salesDemo.regions[0], previous, current }],
});

describe("computeMetrics", () => {
  it("calculates the baseline", () => {
    expect(computeMetrics(salesDemo)).toEqual({
      totalCurrent: 300,
      totalPrevious: 250,
      growthRate: 0.2,
      topRegionId: "region-1",
    });
  });

  it("recalculates the edited example", () => {
    expect(computeMetrics(edit(90))).toEqual({
      totalCurrent: 270,
      totalPrevious: 250,
      growthRate: 0.08,
      topRegionId: "region-2",
    });
  });

  it("uses null for undefined growth and zero-total leader", () => {
    expect(computeMetrics(single(0, 0))).toEqual({
      totalCurrent: 0,
      totalPrevious: 0,
      growthRate: null,
      topRegionId: null,
    });
  });

  it("uses null growth when the previous total is zero", () => {
    expect(computeMetrics(single(0, 50)).growthRate).toBeNull();
    expect(computeMetrics(single(0, 50)).topRegionId).toBe("region-1");
  });

  it("uses import order for ties", () => {
    expect(computeMetrics(edit(100)).topRegionId).toBe("region-1");
  });

  it("handles an empty region list without throwing", () => {
    expect(computeMetrics({ regions: [] })).toEqual({
      totalCurrent: 0,
      totalPrevious: 0,
      growthRate: null,
      topRegionId: null,
    });
  });

  it("keeps full numeric precision for downstream calculations", () => {
    expect(computeMetrics(single(3, 4)).growthRate).toBeCloseTo(1 / 3, 12);
  });
});

describe("formatGrowth", () => {
  it("formats growth only for display", () => {
    expect(formatGrowth(0.08)).toBe("8.00%");
    expect(formatGrowth(0.2)).toBe("20.00%");
    expect(formatGrowth(-0.125)).toBe("-12.50%");
    expect(formatGrowth(0)).toBe("0.00%");
  });

  it("shows an explicit Chinese placeholder for undefined growth", () => {
    expect(formatGrowth(null)).toBe("不适用");
  });
});
