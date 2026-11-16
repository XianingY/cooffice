import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";

describe("salesDemo", () => {
  it("contains the confirmed three-region example", () => {
    expect(salesDemo.regions.map((region) => [region.name, region.previous, region.current])).toEqual([
      ["华东", 100, 120],
      ["华西", 90, 100],
      ["华北", 60, 80],
    ]);
  });
});
