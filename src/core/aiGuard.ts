/**
 * Deterministic guard that keeps AI copy editing away from numeric claims.
 * AI may only polish wording; every numeric token in the original report
 * must survive unchanged and in the same order. No network, DOM or React.
 */
const NUMERIC = /-?\d[\d,]*(?:\.\d+)?/g;

export function extractNumericTokens(text: string): string[] {
  return text.match(NUMERIC) ?? [];
}

export function assertNumbersPreserved(before: string, after: string): void {
  const original = extractNumericTokens(before);
  const polished = extractNumericTokens(after);
  if (original.length !== polished.length || original.some((token, index) => token !== polished[index])) {
    throw new Error("AI 润色结果改变了报告中的数值,已忽略该结果;报告数值仅由确定性计算产生");
  }
}
