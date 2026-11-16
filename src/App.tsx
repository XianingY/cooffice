import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createWordReport } from "./adapters/docx/createWordReport";
import {
  downloadProjectFile,
  readProjectFile,
} from "./adapters/storage/projectFileStorage";
import { clearProject, loadProject, saveProject } from "./adapters/storage/projectStorage";
import {
  CONFIRMED_DOCX_FILENAME,
  downloadBlob,
  downloadSalesWorkbook,
} from "./adapters/xlsx/downloadWorkbook";
import { ColumnMappingDialog } from "./components/ColumnMappingDialog";
import { ConfirmClearDialog } from "./components/ConfirmClearDialog";
import { FileImport } from "./components/FileImport";
import { ImpactList } from "./components/ImpactList";
import { RegionChart } from "./components/RegionChart";
import { ReportConfigPanel } from "./components/ReportConfigPanel";
import { ReportPreview } from "./components/ReportPreview";
import { SalesTable } from "./components/SalesTable";
import { StatusMessage } from "./components/StatusMessage";
import { Toolbar } from "./components/Toolbar";
import { applyColumnMapping } from "./core/columnMapping";
import { buildChart } from "./core/chart";
import { compareSnapshots } from "./core/impacts";
import { computeMetrics } from "./core/metrics";
import { createProjectFile } from "./core/projectFile";
import { buildReport } from "./core/report";
import { DEFAULT_REPORT_CONFIG, normaliseReportConfig } from "./core/reportConfig";
import type { ColumnMapping, ReportConfig, SalesData, TabularInput } from "./core/types";
import { salesDemo } from "./fixtures/salesDemo";
import { initialProjectState, projectReducer, type ProjectState } from "./state/projectReducer";

interface BootResult {
  state: ProjectState;
  warning: string;
}

function bootProject(): BootResult {
  const fallback = (warning = ""): BootResult => ({ state: initialProjectState(salesDemo), warning });
  try {
    const snapshot = loadProject();
    if (snapshot) {
      return {
        state: {
          baseline: snapshot.baseline,
          draft: snapshot.draft,
          selectedImpactId: null,
          sourceCells: [],
        },
        warning: "",
      };
    }
    return fallback();
  } catch {
    return fallback("本地草稿读取失败，已载入示例数据，当前页面内仍可继续编辑和导出");
  }
}

export default function App() {
  const [boot] = useState(bootProject);
  const [state, dispatch] = useReducer(projectReducer, boot.state);
  const [importError, setImportError] = useState("");
  const [exportError, setExportError] = useState("");
  const [storageWarning, setStorageWarning] = useState(boot.warning);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pendingCsv, setPendingCsv] = useState<{
    input: TabularInput;
    suggested: ColumnMapping;
  } | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(() => ({
    ...DEFAULT_REPORT_CONFIG,
    blocks: [...DEFAULT_REPORT_CONFIG.blocks],
  }));
  const skipNextSave = useRef(false);

  // Persist only confirmed/draft data. After "clear" the snapshot stays
  // removed until the user edits or imports again (design spec section 6.5).
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveProject({
        schemaVersion: 1,
        baseline: state.baseline,
        draft: state.draft,
        updatedAt: new Date().toISOString(),
      });
      setStorageWarning("");
    } catch {
      setStorageWarning("本地草稿保存失败，当前页面内仍可继续编辑和导出");
    }
  }, [state.baseline, state.draft]);

  const baselineMetrics = useMemo(() => computeMetrics(state.baseline), [state.baseline]);
  const draftMetrics = useMemo(() => computeMetrics(state.draft), [state.draft]);
  const baselineReport = useMemo(
    () => buildReport(state.baseline, baselineMetrics, reportConfig),
    [state.baseline, baselineMetrics, reportConfig],
  );
  const draftReport = useMemo(
    () => buildReport(state.draft, draftMetrics, reportConfig),
    [state.draft, draftMetrics, reportConfig],
  );
  const draftChart = useMemo(() => buildChart(state.draft), [state.draft]);
  const impacts = useMemo(
    () => compareSnapshots(state.baseline, state.draft),
    [state.baseline, state.draft],
  );
  const hasUnappliedDraft = useMemo(
    () => JSON.stringify(state.baseline) !== JSON.stringify(state.draft),
    [state.baseline, state.draft],
  );

  const handleExportExcel = () => {
    try {
      downloadSalesWorkbook(state.baseline);
      setExportError("");
    } catch {
      setExportError("Excel 导出失败，请重试；当前项目未改变");
    }
  };

  const handleExportWord = async () => {
    try {
      const blob = await createWordReport(state.baseline, baselineReport);
      downloadBlob(blob, CONFIRMED_DOCX_FILENAME);
      setExportError("");
    } catch {
      setExportError("Word 导出失败，请重试；当前项目未改变");
    }
  };

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    if (!pendingCsv) return;
    try {
      const data = applyColumnMapping(pendingCsv.input, mapping);
      setImportError("");
      dispatch({ type: "import", data });
      setPendingCsv(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "CSV 数据校验失败");
    }
  };

  const handleExportProject = () => {
    try {
      downloadProjectFile(
        createProjectFile(state.baseline, state.draft, new Date().toISOString(), reportConfig),
      );
      setExportError("");
    } catch {
      setExportError("项目文件导出失败，请重试；当前项目未改变");
    }
  };

  const handleImportProject = async (file: File) => {
    try {
      const document = await readProjectFile(file);
      setImportError("");
      dispatch({
        type: "importDocument",
        baseline: document.baseline,
        draft: document.draft,
      });
      setReportConfig(normaliseReportConfig(document.config));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "项目文件导入失败");
    }
  };

  const notices = [
    storageWarning,
    hasUnappliedDraft ? "导出已确认版本，不包含未应用草稿" : "",
  ].filter((text): text is string => text !== "");

  const handleClear = () => {
    skipNextSave.current = true;
    try {
      clearProject();
    } catch {
      setStorageWarning("本地草稿清除失败，当前页面内仍可继续编辑和导出");
    }
    dispatch({ type: "clear" });
    setReportConfig({
      ...DEFAULT_REPORT_CONFIG,
      blocks: [...DEFAULT_REPORT_CONFIG.blocks],
    });
    setClearDialogOpen(false);
    setImportError("");
    setExportError("");
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>What-if Report · 数据沙盘</h1>
        <p>导入固定格式 Excel，试改数值，预览指标与报告结论的变化。</p>
      </header>

      <FileImport
        onImport={(data: SalesData) => {
          setImportError("");
          dispatch({ type: "import", data });
        }}
        onCsvInput={(input: TabularInput, suggested: ColumnMapping) => {
          setPendingCsv({ input, suggested });
          setImportError("");
        }}
        onError={setImportError}
      />
      <Toolbar
        hasUnappliedDraft={hasUnappliedDraft}
        onApply={() => dispatch({ type: "apply" })}
        onRevert={() => dispatch({ type: "revert" })}
        onClear={() => setClearDialogOpen(true)}
        onExportExcel={handleExportExcel}
        onExportWord={handleExportWord}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
      />
      <StatusMessage error={importError} exportError={exportError} notices={notices} />
      <ConfirmClearDialog
        open={clearDialogOpen}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={handleClear}
      />
      {pendingCsv ? (
        <ColumnMappingDialog
          input={pendingCsv.input}
          suggested={pendingCsv.suggested}
          onConfirm={handleConfirmMapping}
          onCancel={() => setPendingCsv(null)}
        />
      ) : null}

      <div className="workspace">
        <SalesTable
          data={state.draft}
          sourceCells={state.sourceCells}
          onEdit={(regionId, value) => dispatch({ type: "edit", regionId, value })}
        />
        <ImpactList
          impacts={impacts}
          selectedImpactId={state.selectedImpactId}
          onSelect={(impact) =>
            dispatch({ type: "selectImpact", id: impact.id, sourceCells: impact.sourceCells })
          }
        />
        <ReportPreview
          baselineReport={baselineReport}
          draftReport={draftReport}
          sourceCells={state.sourceCells}
        />
      </div>

      <div className="extras">
        <RegionChart chart={draftChart} />
        <ReportConfigPanel config={reportConfig} onChange={setReportConfig} />
      </div>

      <footer className="app-footer">
        文件仅在浏览器本地处理，不会上传到服务器；导出始终使用已确认版本。
      </footer>
    </main>
  );
}
