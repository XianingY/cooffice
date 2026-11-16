import { DEFAULT_REPORT_CONFIG, normaliseReportConfig } from "./reportConfig";
import type { ProjectFileSnapshot, ReportConfig, SalesData } from "./types";
import { validateSalesData } from "./validation";

export const PROJECT_FILE_VERSION = 3 as const;
export const PROJECT_FILE_FORMAT = "what-if-report-project" as const;

/** Build a portable project document from confirmed and draft data. */
export function createProjectFile(
  baseline: SalesData,
  draft: SalesData,
  updatedAt: string,
  config: ReportConfig = DEFAULT_REPORT_CONFIG,
): ProjectFileSnapshot {
  return {
    schemaVersion: PROJECT_FILE_VERSION,
    format: PROJECT_FILE_FORMAT,
    baseline: validateSalesData(baseline),
    draft: validateSalesData(draft),
    updatedAt,
    config: normaliseReportConfig(config),
  };
}

/**
 * Validate and migrate persisted snapshots or project files. v1 localStorage
 * snapshots and v2 project files are promoted to v3 with default config so
 * existing users keep their data; unknown formats/versions are rejected.
 */
export function parseProjectFile(value: unknown): ProjectFileSnapshot {
  if (typeof value !== "object" || value === null) throw new Error("项目文件结构无效");
  const record = value as Record<string, unknown>;
  const version = record.schemaVersion;

  let baseline: SalesData;
  let draft: SalesData;
  if (version === PROJECT_FILE_VERSION || version === 2 || version === 1) {
    if (version === PROJECT_FILE_VERSION && record.format !== PROJECT_FILE_FORMAT) {
      throw new Error("项目文件格式无效");
    }
    if (version === 2 && record.format !== PROJECT_FILE_FORMAT) {
      throw new Error("项目文件格式无效");
    }
    baseline = validateSalesData(record.baseline);
    draft = validateSalesData(record.draft);
  } else {
    throw new Error("项目文件版本不受支持");
  }

  if (typeof record.updatedAt !== "string") throw new Error("项目文件缺少更新时间");
  const config = normaliseReportConfig(record.config);

  return {
    schemaVersion: PROJECT_FILE_VERSION,
    format: PROJECT_FILE_FORMAT,
    baseline,
    draft,
    updatedAt: record.updatedAt,
    config,
  };
}
