import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import type { TabularInput } from "../../src/core/types";
import {
  createWpsPreview,
  WPS_CAPABILITY_MATRIX,
} from "../../src/adapters/wps/wpsHostAdapter";

const hostTable: TabularInput = {
  headers: ["region", "previous", "current"],
  rows: [
    ["华东", "100", "120"],
    ["华西", "90", "100"],
    ["华北", "60", "80"],
  ],
  source: "csv",
};

describe("createWpsPreview", () => {
  it("reuses core to produce the same metrics, report and chart as the web app", () => {
    const preview = createWpsPreview(hostTable, { region: 0, previous: 1, current: 2 });
    expect(preview.data).toEqual(salesDemo);
    expect(preview.metrics).toEqual({
      totalCurrent: 300,
      totalPrevious: 250,
      growthRate: 0.2,
      topRegionId: "region-1",
    });
    expect(preview.report.blocks[0].text).toBe("当前总销售额为 300 万元。");
    expect(preview.chart.data[0]).toEqual({ regionId: "region-1", name: "华东", value: 120 });
  });

  it("reflects a changed host value without mutating host data", () => {
    const changed: TabularInput = {
      ...hostTable,
      rows: [["华东", "100", "90"], ["华西", "90", "100"], ["华北", "60", "80"]],
    };
    const before = structuredClone(changed);
    const preview = createWpsPreview(changed, { region: 0, previous: 1, current: 2 });
    expect(preview.metrics.totalCurrent).toBe(270);
    expect(preview.metrics.topRegionId).toBe("region-2");
    expect(changed).toEqual(before);
  });

  it("rejects invalid host data through core validation", () => {
    expect(() =>
      createWpsPreview(
        { ...hostTable, rows: [["华东", "一百", "120"]] },
        { region: 0, previous: 1, current: 2 },
      ),
    ).toThrow("第 2 行");
  });
});

describe("capability matrix", () => {
  it("documents supported and unsupported WPS capabilities", () => {
    expect(WPS_CAPABILITY_MATRIX.readActiveSheet).toBe(true);
    expect(WPS_CAPABILITY_MATRIX.showTextPreview).toBe(true);
    expect(WPS_CAPABILITY_MATRIX.writeBackToWorkbook).toBe(false);
    expect(WPS_CAPABILITY_MATRIX.networkCalls).toBe(false);
    expect(WPS_CAPABILITY_MATRIX.verifiedOnRealClient).toBe(false);
  });
});
