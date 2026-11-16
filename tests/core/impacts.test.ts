import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { compareSnapshots } from "../../src/core/impacts";

const edited = {
  regions: salesDemo.regions.map((region, index) => (index === 0 ? { ...region, current: 90 } : { ...region })),
};

describe("compareSnapshots", () => {
  it("returns all expected impacts and no false positives", () => {
    const impacts = compareSnapshots(salesDemo, edited);
    expect(impacts.map((impact) => impact.id)).toEqual([
      "totalCurrent",
      "growthRate",
      "topRegionId",
      "summary",
      "growthNarrative",
      "leaderNarrative",
    ]);
    expect(compareSnapshots(salesDemo, salesDemo)).toEqual([]);
    expect(impacts[0].before).toBe("300 万元");
    expect(impacts[0].after).toBe("270 万元");
  });

  it("reports only ranking impacts when totals are unchanged", () => {
    const swapped = {
      regions: salesDemo.regions.map((region, index) => {
        if (index === 0) return { ...region, current: 100 };
        if (index === 1) return { ...region, current: 120 };
        return { ...region };
      }),
    };
    const impacts = compareSnapshots(salesDemo, swapped);
    expect(impacts.map((impact) => impact.id)).toEqual(["topRegionId", "leaderNarrative"]);
    expect(impacts[0].before).toBe("华东");
    expect(impacts[0].after).toBe("华西");
  });

  it("uses the union of leader cells as ranking evidence", () => {
    const impacts = compareSnapshots(salesDemo, edited);
    const ranking = impacts.find((impact) => impact.id === "topRegionId");
    expect(ranking?.sourceCells).toEqual(["C2", "C3"]);
    expect(ranking?.kind).toBe("ranking");
  });

  it("carries narrative text changes with their evidence", () => {
    const impacts = compareSnapshots(salesDemo, edited);
    const summary = impacts.find((impact) => impact.id === "summary");
    expect(summary?.kind).toBe("narrative");
    expect(summary?.before).toBe("当前总销售额为 300 万元。");
    expect(summary?.after).toBe("当前总销售额为 270 万元。");
    expect(summary?.sourceCells).toEqual(["C2", "C3", "C4"]);
  });

  it("does not mutate either input snapshot", () => {
    const baseline = structuredClone(salesDemo);
    const draft = structuredClone(edited);
    const baselineBefore = structuredClone(baseline);
    const draftBefore = structuredClone(draft);
    compareSnapshots(baseline, draft);
    expect(baseline).toEqual(baselineBefore);
    expect(draft).toEqual(draftBefore);
  });
});
