import type { ProjectFileSnapshot, ProjectSnapshot, SalesData } from "./types";
import { validateSalesData } from "./validation";

export const PROJECT_FILE_VERSION = 2 as const;
export const PROJECT_FILE_FORMAT = "what-if-report-project" as const;

/** Build a portable project document from confirmed and draft data. */
export function createProjectFile(
  baseline: SalesData,
  draft: SalesData,
  updatedAt: string,
): ProjectFileSnapshot {
  return {
    schemaVersion: PROJECT_FILE_VERSION,
    format: PROJECT_FILE_FORMAT,
    baseline: validateSalesData(baseline),
    draft: validateSalesData(draft),
    updatedAt,
  };
}

/**
 * Validate and migrate a persisted snapshot or project file. v0.1.0
 * localStorage snapshots (schemaVersion 1) are promoted to v2 so existing
 * users keep their data; unknown formats and versions are rejected.
 */
export function parseProjectFile(value: unknown): ProjectFileSnapshot {
  if (typeof value !== "object" || value === null) throw new Error("项目文件结构无效");
  const record = value as Record<string, unknown>;
  const version = record.schemaVersion;

  let baseline: SalesData;
  let draft: SalesData;
  if (version === PROJECT_FILE_VERSION) {
    if (record.format !== PROJECT_FILE_FORMAT) throw new Error("项目文件格式无效");
    baseline = validateSalesData(record.baseline);
    draft = validateSalesData(record.draft);
  } else if (version === 1) {
    const snapshot = value as ProjectSnapshot;
    baseline = validateSalesData(snapshot.baseline);
    draft = validateSalesData(snapshot.draft);
  } else {
    throw new Error("项目文件版本不受支持");
  }

  if (typeof record.updatedAt !== "string") throw new Error("项目文件缺少更新时间");
  return {
    schemaVersion: PROJECT_FILE_VERSION,
    format: PROJECT_FILE_FORMAT,
    baseline,
    draft,
    updatedAt: record.updatedAt,
  };
}
