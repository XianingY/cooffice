import { validateSalesData } from "./validation";
import type { ColumnMapping, SalesData, TabularInput } from "./types";

const MAX_REGIONS = 1000;

/** Zero-based column index to spreadsheet-style letters (0 -> A, 26 -> AA). */
export function columnIndexToLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("列映射无效");
  let value = index + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

const ALIASES: Record<keyof ColumnMapping, string[]> = {
  region: ["region", "区域", "地区", "大区", "名称", "name"],
  previous: ["previous", "上期", "上期销售额", "前期", "prev", "last"],
  current: ["current", "当前", "当前销售额", "本期", "now"],
};

const normalise = (header: string): string => header.trim().toLowerCase().replace(/[\s_\-]/g, "");

/** Heuristically detect columns; callers must still show and confirm the mapping. */
export function suggestColumnMapping(input: TabularInput): ColumnMapping {
  const headers = input.headers.map(normalise);
  const find = (aliases: string[]): number => {
    const exact = headers.findIndex((header) => aliases.some((alias) => normalise(alias) === header));
    if (exact >= 0) return exact;
    return headers.findIndex((header) => aliases.some((alias) => header.includes(normalise(alias))));
  };

  const mapping: ColumnMapping = {
    region: find(ALIASES.region),
    previous: find(ALIASES.previous),
    current: find(ALIASES.current),
  };
  const fallback = [0, 1, 2].filter((index) => index < input.headers.length);
  if (mapping.region < 0) mapping.region = fallback[0] ?? 0;
  if (mapping.previous < 0) mapping.previous = fallback[1] ?? 1;
  if (mapping.current < 0) mapping.current = fallback[2] ?? 2;
  return mapping;
}

const DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const GROUPED = /^\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;
const CURRENCY_PREFIX = /^[¥￥$€£]+/;
const CURRENCY_SUFFIX = /[¥￥$€£]+$/;

/**
 * Accept the shapes finance spreadsheets actually contain: thousands
 * separators, currency prefixes/suffixes (including full-width ￥), surrounding
 * whitespace and scientific notation. Negatives stay rejected because the
 * domain has no negative sales figure.
 */
function parseAmount(raw: string | undefined, label: string, rowNumber: number): number {
  const message = `第 ${rowNumber} 行 ${label} 必须是有限的非负数字`;
  const trimmed = (raw ?? "").trim().replace(/[\s\u00a0\u3000]/g, "");
  if (trimmed === "") throw new Error(message);

  // Only strip a currency marker at either edge; "1¥2" is malformed, not 12.
  const withoutCurrency = trimmed.replace(CURRENCY_PREFIX, "").replace(CURRENCY_SUFFIX, "");
  if (withoutCurrency === "") throw new Error(message);

  let numeric = withoutCurrency.startsWith("+") ? withoutCurrency.slice(1) : withoutCurrency;
  if (numeric.includes(",")) {
    if (!GROUPED.test(numeric)) throw new Error(message);
    numeric = numeric.replace(/,/g, "");
  }
  if (!DECIMAL.test(numeric)) throw new Error(message);

  const value = Number(numeric);
  if (!Number.isFinite(value) || value < 0) throw new Error(message);
  return value;
}

/**
 * Convert a confirmed tabular mapping into validated SalesData. Source cells
 * are normalised to B/C columns of the displayed table so the existing impact
 * evidence and highlighting contract remains stable across CSV/XLSX inputs.
 */
export function applyColumnMapping(input: TabularInput, mapping: ColumnMapping): SalesData {
  const indexes = [mapping.region, mapping.previous, mapping.current];
  if (
    indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= input.headers.length) ||
    new Set(indexes).size !== indexes.length
  ) {
    throw new Error("列映射无效：请选择三个不同的有效列");
  }

  const regions: SalesData["regions"] = [];
  input.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const name = (row[mapping.region] ?? "").trim();
    const previousRaw = row[mapping.previous];
    const currentRaw = row[mapping.current];
    if (name === "" && (previousRaw ?? "").trim() === "" && (currentRaw ?? "").trim() === "") return;

    if (name === "") throw new Error(`第 ${rowNumber} 行 区域 不能为空`);
    const previous = parseAmount(previousRaw, "上期销售额", rowNumber);
    const current = parseAmount(currentRaw, "当前销售额", rowNumber);
    regions.push({
      id: `region-${regions.length + 1}`,
      name,
      previous,
      current,
      previousCell: `B${rowNumber}`,
      currentCell: `C${rowNumber}`,
    });
    if (regions.length > MAX_REGIONS) throw new Error("销售数据不能超过 1000 行");
  });

  if (regions.length < 1) throw new Error("销售数据至少包含一行");
  return validateSalesData({ regions });
}
