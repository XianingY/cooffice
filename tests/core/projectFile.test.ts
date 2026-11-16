import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import {
  createProjectFile,
  parseProjectFile,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
} from "../../src/core/projectFile";
import type { ProjectSnapshot } from "../../src/core/types";

const v1Snapshot: ProjectSnapshot = {
  schemaVersion: 1,
  baseline: salesDemo,
  draft: salesDemo,
  updatedAt: "2026-11-16T00:00:00.000Z",
};

describe("createProjectFile", () => {
  it("creates a versioned project document with the confirmed data", () => {
    const file = createProjectFile(salesDemo, salesDemo, "2026-11-16T00:00:00.000Z");
    expect(file.schemaVersion).toBe(PROJECT_FILE_VERSION);
    expect(file.format).toBe(PROJECT_FILE_FORMAT);
    expect(file.baseline).toEqual(salesDemo);
    expect(file.draft).toEqual(salesDemo);
    expect(file.updatedAt).toBe("2026-11-16T00:00:00.000Z");
    expect(file.baseline).not.toBe(salesDemo);
  });
});

describe("parseProjectFile", () => {
  it("migrates a v1 localStorage snapshot to the current project file", () => {
    const migrated = parseProjectFile(v1Snapshot);
    expect(migrated.schemaVersion).toBe(PROJECT_FILE_VERSION);
    expect(migrated.format).toBe(PROJECT_FILE_FORMAT);
    expect(migrated.updatedAt).toBe(v1Snapshot.updatedAt);
    expect(migrated.baseline).toEqual(salesDemo);
  });

  it("round-trips a current project file", () => {
    const file = createProjectFile(salesDemo, salesDemo, "2026-11-16T00:00:00.000Z");
    expect(parseProjectFile(JSON.parse(JSON.stringify(file)))).toEqual(file);
  });

  it("preserves draft edits separately from baseline", () => {
    const draft = structuredClone(salesDemo);
    draft.regions[0].current = 90;
    const file = createProjectFile(salesDemo, draft, "2026-11-16T00:00:00.000Z");
    const parsed = parseProjectFile(file);
    expect(parsed.baseline.regions[0].current).toBe(120);
    expect(parsed.draft.regions[0].current).toBe(90);
  });

  it("rejects unknown formats, unknown versions and malformed data", () => {
    expect(() => parseProjectFile(null)).toThrow("项目文件");
    expect(() => parseProjectFile({ schemaVersion: 2, format: "other" })).toThrow("项目文件");
    expect(() => parseProjectFile({ ...v1Snapshot, schemaVersion: 99 })).toThrow("版本");
    expect(() => parseProjectFile({ ...v1Snapshot, updatedAt: 123 })).toThrow("项目文件");
    const broken = structuredClone(v1Snapshot) as unknown as Record<string, unknown>;
    broken.baseline = { regions: [{ ...salesDemo.regions[0], current: -1 }] };
    expect(() => parseProjectFile(broken)).toThrow("非负");
  });
});
