import { useEffect, useRef, useState } from "react";
import { clearProject, loadProject, saveProject } from "../adapters/storage/projectStorage";
import { createProjectFile } from "../core/projectFile";
import { DEFAULT_REPORT_CONFIG, normaliseReportConfig } from "../core/reportConfig";
import type { ReportConfig, SalesData } from "../core/types";
import { salesDemo } from "../fixtures/salesDemo";
import { initialProjectState, type ProjectState } from "../state/projectReducer";

export interface BootResult {
  state: ProjectState;
  warning: string;
  config: ReportConfig;
}

export const defaultReportConfig = (): ReportConfig => ({
  ...DEFAULT_REPORT_CONFIG,
  blocks: [...DEFAULT_REPORT_CONFIG.blocks],
});

/** Restore the last local snapshot on startup, falling back to the demo data. */
export function bootLocalProject(): BootResult {
  const fallback = (warning = ""): BootResult => ({
    state: initialProjectState(salesDemo),
    warning,
    config: defaultReportConfig(),
  });
  try {
    const document = loadProject();
    if (document) {
      return {
        state: {
          baseline: document.baseline,
          draft: document.draft,
          selectedImpactId: null,
          sourceCells: [],
        },
        warning: "",
        config: normaliseReportConfig(document.config),
      };
    }
    return fallback();
  } catch {
    return fallback("本地草稿读取失败，已载入示例数据，当前页面内仍可继续编辑和导出");
  }
}

/**
 * Sync confirmed/draft state and report config into localStorage. After an
 * explicit "clear", the snapshot stays deleted until the next edit or import.
 */
export function useLocalPersistence(
  baseline: SalesData,
  draft: SalesData,
  reportConfig: ReportConfig,
  initialWarning: string,
) {
  const [storageWarning, setStorageWarning] = useState(initialWarning);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveProject(createProjectFile(baseline, draft, new Date().toISOString(), reportConfig));
      setStorageWarning("");
    } catch {
      setStorageWarning("本地草稿保存失败，当前页面内仍可继续编辑和导出");
    }
  }, [baseline, draft, reportConfig]);

  const clearStorage = () => {
    skipNextSave.current = true;
    try {
      clearProject();
    } catch {
      setStorageWarning("本地草稿清除失败，当前页面内仍可继续编辑和导出");
    }
  };

  return { storageWarning, clearStorage };
}
