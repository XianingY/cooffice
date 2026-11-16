import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { initialProjectState, projectReducer } from "../../src/state/projectReducer";
import { compareSnapshots } from "../../src/core/impacts";

describe("projectReducer", () => {
  it("edits only draft, then applies and reverts", () => {
    const start = initialProjectState(salesDemo);
    const edited = projectReducer(start, { type: "edit", regionId: "region-1", value: 90 });
    expect(edited.baseline.regions[0].current).toBe(120);
    expect(edited.draft.regions[0].current).toBe(90);

    const applied = projectReducer(edited, { type: "apply" });
    expect(applied.baseline.regions[0].current).toBe(90);
    const reverted = projectReducer(edited, { type: "revert" });
    expect(reverted.draft).toEqual(edited.baseline);
  });

  it("starts from two independent deep copies", () => {
    const start = initialProjectState(salesDemo);
    expect(start.baseline).toEqual(salesDemo);
    expect(start.draft).toEqual(salesDemo);
    expect(start.baseline).not.toBe(salesDemo);
    expect(start.draft).not.toBe(start.baseline);
    expect(start.draft.regions[0]).not.toBe(start.baseline.regions[0]);
    expect(start.selectedImpactId).toBeNull();
    expect(start.sourceCells).toEqual([]);
  });

  it("clears selection and evidence on edit, apply and revert", () => {
    const selected = projectReducer(initialProjectState(salesDemo), {
      type: "selectImpact",
      id: "totalCurrent",
      sourceCells: ["C2", "C3"],
    });
    expect(selected.selectedImpactId).toBe("totalCurrent");
    expect(selected.sourceCells).toEqual(["C2", "C3"]);

    for (const action of [
      { type: "edit", regionId: "region-1", value: 90 },
      { type: "apply" },
      { type: "revert" },
    ] as const) {
      const next = projectReducer(selected, action);
      expect(next.selectedImpactId).toBeNull();
      expect(next.sourceCells).toEqual([]);
    }
  });

  it("leaves no impacts after apply or revert", () => {
    const edited = projectReducer(initialProjectState(salesDemo), { type: "edit", regionId: "region-1", value: 90 });
    for (const action of [{ type: "apply" }, { type: "revert" }] as const) {
      const next = projectReducer(edited, action);
      expect(compareSnapshots(next.baseline, next.draft)).toEqual([]);
    }
  });

  it("rejects invalid numeric edits and unknown regions", () => {
    const start = initialProjectState(salesDemo);
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(projectReducer(start, { type: "edit", regionId: "region-1", value })).toBe(start);
    }
    expect(projectReducer(start, { type: "edit", regionId: "missing", value: 90 })).toBe(start);
  });

  it("supports zero as a valid edit", () => {
    const next = projectReducer(initialProjectState(salesDemo), { type: "edit", regionId: "region-1", value: 0 });
    expect(next.draft.regions[0].current).toBe(0);
  });

  it("resets to the fictional example on clear and replaces state on import", () => {
    const edited = projectReducer(initialProjectState(salesDemo), { type: "edit", regionId: "region-1", value: 90 });
    const cleared = projectReducer(edited, { type: "clear" });
    expect(cleared.baseline).toEqual(salesDemo);
    expect(cleared.draft).toEqual(salesDemo);

    const imported = { regions: [{ ...salesDemo.regions[0], name: "新区域", id: "region-1" }] };
    const importedState = projectReducer(edited, { type: "import", data: imported });
    expect(importedState.baseline).toEqual(imported);
    expect(importedState.draft).toEqual(imported);
    expect(importedState.selectedImpactId).toBeNull();
  });

  it("isolates baseline from later draft mutations", () => {
    const edited = projectReducer(initialProjectState(salesDemo), { type: "edit", regionId: "region-2", value: 200 });
    expect(edited.baseline.regions[1].current).toBe(100);
    expect(edited.draft.regions[1].current).toBe(200);
    expect(edited.baseline.regions[1]).not.toBe(edited.draft.regions[1]);
  });
});
