/**
 * Display-only formatting. Never feed the returned string back into a
 * calculation: the domain layer keeps the raw numeric growthRate.
 */
export function formatGrowth(value: number | null): string {
  return value === null ? "不适用" : `${(value * 100).toFixed(2)}%`;
}
