import { useState } from "react";
import { PROJECT_FILE_FILENAME, serialiseProjectFile } from "../adapters/storage/projectFileStorage";
import {
  CONFIRMED_DOCX_FILENAME,
  CONFIRMED_XLSX_FILENAME,
  DRAFT_DOCX_FILENAME,
  DRAFT_XLSX_FILENAME,
} from "../adapters/xlsx/filenames";
import type { ExportSource } from "../components/Toolbar";
import { createProjectFile } from "../core/projectFile";
import type { ReportConfig, ReportModel, SalesData } from "../core/types";
import {
  bytesToBlob,
  saveBlob,
  shortPath,
  trackDocument,
  type SaveBlobOutcome,
} from "../desktop/bridge";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface UseProjectExportParams {
  baseline: SalesData;
  draft: SalesData;
  baselineReport: ReportModel;
  draftReport: ReportModel;
  reportConfig: ReportConfig;
  exportSource: ExportSource;
}

/** Lazily loads Excel/Word writers and routes saves through desktop or browser download. */
export function useProjectExport({
  baseline,
  draft,
  baselineReport,
  draftReport,
  reportConfig,
  exportSource,
}: UseProjectExportParams) {
  const [exportError, setExportError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{ message: string; path?: string } | null>(null);

  const exportData = exportSource === "draft" ? draft : baseline;
  const exportReport = exportSource === "draft" ? draftReport : baselineReport;

  const reportSave = (label: string, outcome: SaveBlobOutcome) => {
    if (!outcome.saved) {
      setExportError(outcome.error ?? "");
      return;
    }
    setExportError("");
    setSaveNotice(
      outcome.filePath
        ? { message: `${label}已保存到 ${shortPath(outcome.filePath)}`, path: outcome.filePath }
        : { message: `${label}已开始下载` },
    );
  };

  const handleExportExcel = async () => {
    try {
      const { createSalesWorkbookBytes } = await import("../adapters/xlsx/downloadWorkbook");
      const blob = bytesToBlob(createSalesWorkbookBytes(exportData), XLSX_MIME);
      reportSave(
        exportSource === "draft" ? "草稿 Excel " : "Excel ",
        await saveBlob(blob, {
          suggestedName: exportSource === "draft" ? DRAFT_XLSX_FILENAME : CONFIRMED_XLSX_FILENAME,
          filterName: "Excel 工作簿",
          extensions: ["xlsx"],
        }),
      );
    } catch {
      setExportError("Excel 导出失败，请重试；当前项目未改变");
    }
  };

  const handleExportWord = async () => {
    try {
      const { createWordReport } = await import("../adapters/docx/createWordReport");
      const blob = await createWordReport(exportData, exportReport, exportSource);
      reportSave(
        exportSource === "draft" ? "草稿 Word " : "Word ",
        await saveBlob(blob, {
          suggestedName: exportSource === "draft" ? DRAFT_DOCX_FILENAME : CONFIRMED_DOCX_FILENAME,
          filterName: "Word 文档",
          extensions: ["docx"],
        }),
      );
    } catch {
      setExportError("Word 导出失败，请重试；当前项目未改变");
    }
  };

  const handleExportProject = async (inPlace = false) => {
    try {
      const snapshot = createProjectFile(baseline, draft, new Date().toISOString(), reportConfig);
      const blob = bytesToBlob(new TextEncoder().encode(serialiseProjectFile(snapshot)), "application/json");
      const outcome = await saveBlob(blob, {
        suggestedName: PROJECT_FILE_FILENAME,
        filterName: "What-if 项目",
        extensions: ["whatif", "json"],
        inPlace,
      });
      reportSave("项目文件", outcome);
      if (outcome.saved && outcome.filePath) trackDocument(outcome.filePath);
    } catch {
      setExportError("项目文件导出失败，请重试；当前项目未改变");
    }
  };

  return {
    exportError,
    setExportError,
    saveNotice,
    clearExportNotices: () => {
      setExportError("");
      setSaveNotice(null);
    },
    handleExportExcel,
    handleExportWord,
    handleExportProject,
  };
}
