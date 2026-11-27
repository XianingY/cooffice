/**
 * Display-only formatting. Never feed returned strings back into a
 * calculation: the domain layer keeps raw numeric values.
 */
export function formatAmount(value: number): string {
  const rounded = Number(value.toFixed(10));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function formatGrowth(value: number | null): string {
  return value === null ? "不适用" : `${(value * 100).toFixed(2)}%`;
}
