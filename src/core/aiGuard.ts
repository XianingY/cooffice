/**
 * Deterministic guard that keeps AI copy editing away from numeric claims.
 * AI may only polish wording; every numeric token — and any attached unit such
 * as `%` or `万元` — must survive unchanged and in the same order.
 */
const NUMERIC = /-?\d[\d,]*(?:\.\d+)?/g;
const QUANTITY = /-?\d[\d,]*(?:\.\d+)?(?:[ \t]*(?:%|万元|亿元|千元|元))?/g;

export function extractNumericTokens(text: string): string[] {
  return text.match(NUMERIC) ?? [];
}

function extractQuantityTokens(text: string): string[] {
  return (text.match(QUANTITY) ?? []).map((token) => token.replace(/[ \t]+/g, ""));
}

export function assertNumbersPreserved(before: string, after: string): void {
  const original = extractNumericTokens(before);
  const polished = extractNumericTokens(after);
  if (original.length !== polished.length || original.some((token, index) => token !== polished[index])) {
    throw new Error("AI 润色结果改变了报告中的数值,已忽略该结果;报告数值仅由确定性计算产生");
  }
  const originalQuantities = extractQuantityTokens(before);
  const polishedQuantities = extractQuantityTokens(after);
  if (
    originalQuantities.length !== polishedQuantities.length ||
    originalQuantities.some((token, index) => token !== polishedQuantities[index])
  ) {
    throw new Error("AI 润色结果改变了报告中的数值或单位,已忽略该结果;报告数值仅由确定性计算产生");
  }
}
