import type { SalesData } from "./types";

const MAX_REGIONS = 1000;

function assertAmount(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}必须是有限的非负数字`);
  }
}

/**
 * Runtime structural validation for every SalesData entering the app (import,
 * persisted snapshot, reducer payload). Throws Chinese messages so import
 * failures can be shown verbatim without leaking file content.
 */
export function validateSalesData(value: unknown): SalesData {
  if (typeof value !== "object" || value === null || !Array.isArray((value as SalesData).regions)) {
    throw new Error("销售数据结构无效");
  }

  const { regions } = value as SalesData;
  if (regions.length < 1) throw new Error("销售数据至少包含一行");
  if (regions.length > MAX_REGIONS) throw new Error("销售数据不能超过 1000 行");

  const names = new Set<string>();
  const ids = new Set<string>();
  for (const region of regions) {
    if (typeof region !== "object" || region === null) throw new Error("区域数据无效");
    if (typeof region.id !== "string" || !region.id || typeof region.name !== "string" || !region.name) {
      throw new Error("区域名称不能为空");
    }
    if (names.has(region.name)) throw new Error("区域名称不能重复");
    if (ids.has(region.id)) throw new Error("区域标识不能重复");
    names.add(region.name);
    ids.add(region.id);

    assertAmount(region.previous, `${region.name}上期销售额`);
    assertAmount(region.current, `${region.name}当前销售额`);

    if (!/^B\d+$/.test(region.previousCell) || !/^C\d+$/.test(region.currentCell)) {
      throw new Error("来源单元格映射无效");
    }
    if (region.previousCell.slice(1) !== region.currentCell.slice(1)) {
      throw new Error("来源单元格必须位于同一行");
    }
  }

  return { regions: regions.map((region) => ({ ...region })) };
}
