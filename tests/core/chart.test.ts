import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { buildChart } from "../../src/core/chart";

describe("buildChart", () => {
  it("creates a deterministic per-region bar chart from the data", () => {
    const chart = buildChart(salesDemo);
    expect(chart.title).toBe("各区域当前销售额");
    expect(chart.unit).toBe("万元");
    expect(chart.data).toEqual([
      { regionId: "region-1", name: "华东", value: 120 },
      { regionId: "region-2", name: "华西", value: 100 },
      { regionId: "region-3", name: "华北", value: 80 },
    ]);
  });

  it("reflects edited values and never mutates input", () => {
    const edited = structuredClone(salesDemo);
    edited.regions[0].current = 90;
    const snapshot = structuredClone(edited);
    const chart = buildChart(edited);
    expect(chart.data[0].value).toBe(90);
    expect(edited).toEqual(snapshot);
  });

  it("handles an empty dataset", () => {
    expect(buildChart({ regions: [] }).data).toEqual([]);
  });
});
