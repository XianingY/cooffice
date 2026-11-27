import { describe, expect, it } from "vitest";
import type { TabularInput } from "../../src/core/types";
import {
  applyColumnMapping,
  columnIndexToLetter,
  suggestColumnMapping,
} from "../../src/core/columnMapping";

const canonical: TabularInput = {
  headers: ["区域", "上期销售额", "当前销售额"],
  rows: [
    ["华东", "100", "120"],
    ["华西", "90", "100"],
    ["华北", "60", "80"],
  ],
  source: "csv",
};

describe("columnIndexToLetter", () => {
  it("maps zero-based indexes to spreadsheet letters", () => {
    expect(columnIndexToLetter(0)).toBe("A");
    expect(columnIndexToLetter(1)).toBe("B");
    expect(columnIndexToLetter(25)).toBe("Z");
    expect(columnIndexToLetter(26)).toBe("AA");
    expect(columnIndexToLetter(27)).toBe("AB");
  });
});

describe("suggestColumnMapping", () => {
  it("recognises Chinese and English headers", () => {
    expect(suggestColumnMapping(canonical)).toEqual({ region: 0, previous: 1, current: 2 });
    expect(
      suggestColumnMapping({ ...canonical, headers: ["current", "region", "previous"] }),
    ).toEqual({ region: 1, previous: 2, current: 0 });
  });

  it("falls back to the first three columns for unknown headers", () => {
    expect(suggestColumnMapping({ ...canonical, headers: ["c1", "c2", "c3", "c4"] })).toEqual({
      region: 0,
      previous: 1,
      current: 2,
    });
  });
});

describe("applyColumnMapping", () => {
  it("maps rows into SalesData with normalised source cells", () => {
    const data = applyColumnMapping(canonical, { region: 0, previous: 1, current: 2 });
    expect(data.regions.map((r) => [r.name, r.previous, r.current])).toEqual([
      ["华东", 100, 120],
      ["华西", 90, 100],
      ["华北", 60, 80],
    ]);
    expect(data.regions[0]).toMatchObject({
      id: "region-1",
      previousCell: "B2",
      currentCell: "C2",
    });
    expect(data.regions[2]).toMatchObject({
      id: "region-3",
      previousCell: "B4",
      currentCell: "C4",
    });
  });

  it("honours a reordered mapping and keeps the normalised cell addresses", () => {
    const reordered: TabularInput = {
      headers: ["当前", "区域", "上期"],
      rows: [["120", "华东", "100"]],
      source: "csv",
    };
    const data = applyColumnMapping(reordered, { region: 1, previous: 2, current: 0 });
    expect(data.regions[0]).toMatchObject({
      name: "华东",
      previous: 100,
      current: 120,
      previousCell: "B2",
      currentCell: "C2",
    });
  });

  it("skips fully blank rows without shifting later row numbers", () => {
    const withBlank: TabularInput = {
      ...canonical,
      rows: [["华东", "100", "120"], ["", "", ""], ["华西", "90", "100"]],
    };
    const data = applyColumnMapping(withBlank, { region: 0, previous: 1, current: 2 });
    expect(data.regions.map((r) => [r.name, r.currentCell])).toEqual([
      ["华东", "C2"],
      ["华西", "C4"],
    ]);
  });

  it("accepts decimal strings and scientific notation, rejecting non-numeric or negative values", () => {
    expect(
      applyColumnMapping({ ...canonical, rows: [["华东", "10.5", "0"]] }, { region: 0, previous: 1, current: 2 })
        .regions[0],
    ).toMatchObject({ previous: 10.5, current: 0 });
    expect(
      applyColumnMapping({ ...canonical, rows: [["华东", "1e3", "1.25E+2"]] }, { region: 0, previous: 1, current: 2 })
        .regions[0],
    ).toMatchObject({ previous: 1000, current: 125 });
    expect(() =>
      applyColumnMapping({ ...canonical, rows: [["华东", "1e", "5"]] }, { region: 0, previous: 1, current: 2 }),
    ).toThrow("第 2 行");
    expect(() =>
      applyColumnMapping({ ...canonical, rows: [["华东", "100", "-1"]] }, { region: 0, previous: 1, current: 2 }),
    ).toThrow("非负");
    expect(() =>
      applyColumnMapping({ ...canonical, rows: [["华东", "", "5"]] }, { region: 0, previous: 1, current: 2 }),
    ).toThrow("第 2 行");
  });

  it("accepts thousands separators and currency markers from real exports", () => {
    const data = applyColumnMapping(
      { ...canonical, rows: [["华东", "1,000", "¥1,200.50"], ["华西", "￥900", "$1,000"]] },
      { region: 0, previous: 1, current: 2 },
    );
    expect(data.regions.map((r) => [r.previous, r.current])).toEqual([
      [1000, 1200.5],
      [900, 1000],
    ]);
  });

  it("still rejects negatives, malformed separators and mid-string currency", () => {
    for (const [previous, current] of [["-1", "5"], ["1,00", "5"], ["1¥2", "5"], ["5", "abc"]]) {
      expect(() =>
        applyColumnMapping({ ...canonical, rows: [["华东", previous, current]] }, { region: 0, previous: 1, current: 2 }),
      ).toThrow("第 2 行");
    }
  });

  it("rejects duplicate names, empty data and invalid mappings", () => {
    expect(() =>
      applyColumnMapping({ ...canonical, rows: [["华东", "1", "2"], ["华东", "3", "4"]] }, { region: 0, previous: 1, current: 2 }),
    ).toThrow("重复");
    expect(() =>
      applyColumnMapping({ ...canonical, rows: [] }, { region: 0, previous: 1, current: 2 }),
    ).toThrow("至少包含一行");
    expect(() => applyColumnMapping(canonical, { region: 0, previous: 1, current: 1 })).toThrow("映射");
    expect(() => applyColumnMapping(canonical, { region: 0, previous: 1, current: 9 })).toThrow("映射");
  });

  it("rejects more than 1000 data rows", () => {
    const rows = Array.from({ length: 1001 }, (_, i) => [`区域${i + 1}`, "1", "2"]);
    expect(() =>
      applyColumnMapping({ ...canonical, rows }, { region: 0, previous: 1, current: 2 }),
    ).toThrow("1000");
  });
});
