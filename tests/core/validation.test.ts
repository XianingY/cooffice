import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { validateSalesData } from "../../src/core/validation";

describe("validateSalesData", () => {
  it("accepts the canonical fixture", () => {
    expect(validateSalesData(salesDemo)).toEqual(salesDemo);
  });

  it("returns a defensive copy instead of sharing references", () => {
    const result = validateSalesData(salesDemo);
    expect(result).not.toBe(salesDemo);
    expect(result.regions[0]).not.toBe(salesDemo.regions[0]);
  });

  it("rejects empty data", () => {
    expect(() => validateSalesData({ regions: [] })).toThrow("至少包含一行");
  });

  it("rejects negative and non-finite values", () => {
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], current: -1 }] })).toThrow("非负数字");
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], current: Number.NaN }] })).toThrow("非负数字");
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], current: Number.POSITIVE_INFINITY }] })).toThrow("非负数字");
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], previous: -0.5 }] })).toThrow("非负数字");
  });

  it("rejects text numbers", () => {
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], current: "120" as unknown as number }] })).toThrow("非负数字");
  });

  it("rejects more than 1000 rows", () => {
    const regions = Array.from({ length: 1001 }, (_, index) => ({
      ...salesDemo.regions[0],
      id: `region-${index + 1}`,
      name: `区域${index + 1}`,
    }));
    expect(() => validateSalesData({ regions })).toThrow("不能超过 1000 行");
  });

  it("accepts exactly 1000 rows", () => {
    const regions = Array.from({ length: 1000 }, (_, index) => ({
      ...salesDemo.regions[0],
      id: `region-${index + 1}`,
      name: `区域${index + 1}`,
    }));
    expect(validateSalesData({ regions }).regions).toHaveLength(1000);
  });

  it("rejects duplicate names and ids and empty names", () => {
    expect(() => validateSalesData({ regions: [salesDemo.regions[0], { ...salesDemo.regions[1], name: "华东" }] })).toThrow("区域名称不能重复");
    expect(() => validateSalesData({ regions: [salesDemo.regions[0], { ...salesDemo.regions[1], id: "region-1" }] })).toThrow("区域标识不能重复");
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], name: "" }] })).toThrow("区域名称不能为空");
  });

  it("rejects invalid source-cell mappings", () => {
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], previousCell: "D2" }] })).toThrow("映射无效");
    expect(() => validateSalesData({ regions: [{ ...salesDemo.regions[0], currentCell: "C3" }] })).toThrow("同一行");
  });

  it("rejects structurally invalid input", () => {
    expect(() => validateSalesData(null)).toThrow("结构无效");
    expect(() => validateSalesData({ regions: "nope" })).toThrow("结构无效");
    expect(() => validateSalesData({ regions: [null] })).toThrow("区域数据无效");
  });
});
