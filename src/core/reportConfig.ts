import type { ReportBlockId, ReportConfig } from "./types";

const KNOWN_BLOCKS: ReportBlockId[] = ["summary", "growthNarrative", "leaderNarrative"];

export const DEFAULT_REPORT_CONFIG: Readonly<ReportConfig> = {
  blocks: [...KNOWN_BLOCKS],
};

/** Validate and normalise untrusted config while preserving user-chosen order. */
export function normaliseReportConfig(value: unknown): ReportConfig {
  if (typeof value !== "object" || value === null || !Array.isArray((value as ReportConfig).blocks)) {
    return { blocks: [...DEFAULT_REPORT_CONFIG.blocks] };
  }
  const seen = new Set<ReportBlockId>();
  const blocks: ReportBlockId[] = [];
  for (const id of (value as ReportConfig).blocks) {
    if (KNOWN_BLOCKS.includes(id) && !seen.has(id)) {
      seen.add(id);
      blocks.push(id);
    }
  }
  return { blocks };
}

/** Pure, deterministic block plan used by the report builder. */
export function planReportBlocks(config: ReportConfig): ReportBlockId[] {
  return normaliseReportConfig(config).blocks;
}
