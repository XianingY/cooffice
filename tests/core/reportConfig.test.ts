import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPORT_CONFIG,
  normaliseReportConfig,
  planReportBlocks,
} from "../../src/core/reportConfig";
import type { ReportConfig } from "../../src/core/types";

describe("normaliseReportConfig", () => {
  it("returns a defensive copy of the defaults for invalid input", () => {
    expect(normaliseReportConfig(null)).toEqual(DEFAULT_REPORT_CONFIG);
    expect(normaliseReportConfig({})).toEqual(DEFAULT_REPORT_CONFIG);
    expect(normaliseReportConfig(DEFAULT_REPORT_CONFIG)).not.toBe(DEFAULT_REPORT_CONFIG);
  });

  it("keeps only known block ids, removes duplicates and preserves order", () => {
    const config = normaliseReportConfig({
      blocks: ["leaderNarrative", "bogus", "summary", "leaderNarrative"],
    });
    expect(config.blocks).toEqual(["leaderNarrative", "summary"]);
  });

  it("accepts an empty block list (a minimal report is valid)", () => {
    expect(normaliseReportConfig({ blocks: [] }).blocks).toEqual([]);
  });
});

describe("planReportBlocks", () => {
  it("uses the default three blocks in order", () => {
    const config: ReportConfig = normaliseReportConfig(DEFAULT_REPORT_CONFIG);
    expect(planReportBlocks(config)).toEqual(["summary", "growthNarrative", "leaderNarrative"]);
  });

  it("follows a custom order and subset", () => {
    const config = normaliseReportConfig({ blocks: ["leaderNarrative", "summary"] });
    expect(planReportBlocks(config)).toEqual(["leaderNarrative", "summary"]);
  });

  it("is deterministic and does not mutate config", () => {
    const config = normaliseReportConfig({ blocks: ["summary", "leaderNarrative"] });
    const before = structuredClone(config);
    expect(planReportBlocks(config)).toEqual(planReportBlocks(config));
    expect(config).toEqual(before);
  });
});
