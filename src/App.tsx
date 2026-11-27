import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  parseProjectFileText,
  PROJECT_FILE_FILENAME,
  readProjectFile,
  serialiseProjectFile,
} from "./adapters/storage/projectFileStorage";
import { clearProject, loadProject, saveProject } from "./adapters/storage/projectStorage";
import { importTabularFile } from "./adapters/tabular/importTabularFile";
import {
  CONFIRMED_DOCX_FILENAME,
  CONFIRMED_XLSX_FILENAME,
  DRAFT_DOCX_FILENAME,
  DRAFT_XLSX_FILENAME,
} from "./adapters/xlsx/filenames";
import { AiPolishDialog } from "./components/AiPolishDialog";
import { ColumnMappingDialog } from "./components/ColumnMappingDialog";
import { CloudPanel } from "./components/CloudPanel";
import { ConfirmClearDialog } from "./components/ConfirmClearDialog";
import { ConfirmImportDialog } from "./components/ConfirmImportDialog";
import { DesktopFooter } from "./components/DesktopFooter";
import { FileImport } from "./components/FileImport";
import { ImpactList } from "./components/ImpactList";
import { RegionChart } from "./components/RegionChart";
import { ReportConfigPanel } from "./components/ReportConfigPanel";
import { ReportPreview } from "./components/ReportPreview";
import { SalesTable } from "./components/SalesTable";
import { StatusMessage } from "./components/StatusMessage";
import { Toolbar, type ExportSource } from "./components/Toolbar";
import { applyColumnMapping } from "./core/columnMapping";
import { buildChart } from "./core/chart";
import { compareSnapshots } from "./core/impacts";
import { computeMetrics } from "./core/metrics";
import { createProjectFile } from "./core/projectFile";
import { buildReport } from "./core/report";
import { DEFAULT_REPORT_CONFIG, normaliseReportConfig } from "./core/reportConfig";
import type { ColumnMapping, ReportConfig, SalesData, TabularInput } from "./core/types";
import type { ThemeSetting } from "./desktop/bridge";
import {
  applyDesktopShellChrome,
  bytesToBlob,
  forgetCurrentFilePath,
  getDesktop,
  saveBlob,
  setDocumentEdited,
  shortPath,
  toFile,
  trackDocument,
  type SaveBlobOutcome,
} from "./desktop/bridge";
import { useFileDrop } from "./hooks/useFileDrop";
import { salesDemo } from "./fixtures/salesDemo";
import { initialProjectState, projectReducer, type ProjectState } from "./state/projectReducer";
import { currentTheme, initTheme, setTheme, subscribeTheme } from "./theme";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface BootResult {
  state: ProjectState;
  warning: string;
  config: ReportConfig;
}

const defaultConfig = (): ReportConfig => ({
  ...DEFAULT_REPORT_CONFIG,
  blocks: [...DEFAULT_REPORT_CONFIG.blocks],
});

function bootProject(): BootResult {
  const fallback = (warning = ""): BootResult => ({
    state: initialProjectState(salesDemo),
    warning,
    config: defaultConfig(),
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

export default function App() {
  const [boot] = useState(bootProject);
  const [state, dispatch] = useReducer(projectReducer, boot.state);
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState<{ label: string; apply: () => void } | null>(null);
  const [exportError, setExportError] = useState("");
  const [storageWarning, setStorageWarning] = useState(boot.warning);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pendingCsv, setPendingCsv] = useState<{
    input: TabularInput;
    suggested: ColumnMapping;
  } | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(boot.config);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPolishedText, setAiPolishedText] = useState("");
  const [saveNotice, setSaveNotice] = useState<{ message: string; path?: string } | null>(null);
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => currentTheme().setting);
  const [exportSource, setExportSource] = useState<ExportSource>("baseline");
  const skipNextSave = useRef(false);
  const desktop = useMemo(() => getDesktop(), []);

  // Persist only confirmed/draft data. After "clear" the snapshot stays
  // removed until the user edits or imports again (design spec section 6.5).
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      saveProject(
        createProjectFile(state.baseline, state.draft, new Date().toISOString(), reportConfig),
      );
      setStorageWarning("");
    } catch {
      setStorageWarning("本地草稿保存失败，当前页面内仍可继续编辑和导出");
    }
  }, [state.baseline, state.draft, reportConfig]);

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

  // Derived from state so every mutation path is covered without flags: an
  // edited baseline, an unapplied draft, or a changed report config all mean
  // an import would destroy something the user cares about.
  const hasWork = useMemo(
    () =>
      JSON.stringify(state.baseline) !== JSON.stringify(salesDemo) ||
      hasUnappliedDraft ||
      JSON.stringify(reportConfig) !== JSON.stringify(DEFAULT_REPORT_CONFIG),
    [state.baseline, hasUnappliedDraft, reportConfig],
  );

  const runImport = (label: string, apply: () => void) => {
    if (hasWork) setPendingImport({ label, apply });
    else apply();
  };

  // macOS shows an unsaved-changes dot in the close button.
  useEffect(() => {
    setDocumentEdited(hasUnappliedDraft);
  }, [hasUnappliedDraft]);

  // One theme controller serves both shells; the shell decides where the
  // preference lives and this component only mirrors it for the toolbar.
  useEffect(() => {
    const unsubscribe = subscribeTheme((state) => setThemeSetting(state.setting));
    const teardown = initTheme();
    return () => {
      teardown();
      unsubscribe();
    };
  }, []);

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

  // Exporting the draft lets a what-if result leave the app without first
  // applying it (which would destroy the comparison baseline).
  const exportData = exportSource === "draft" ? state.draft : state.baseline;
  const exportReport = exportSource === "draft" ? draftReport : baselineReport;
  const exportLabel = exportSource === "draft" ? "草稿 Excel " : "Excel ";

  const handleExportExcel = async () => {
    try {
      // SheetJS is only fetched when the user actually exports a workbook.
      const { createSalesWorkbookBytes } = await import("./adapters/xlsx/downloadWorkbook");
      const blob = bytesToBlob(createSalesWorkbookBytes(exportData), XLSX_MIME);
      reportSave(
        exportLabel,
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
      // Load the DOCX library only when the user actually exports Word.
      const { createWordReport } = await import("./adapters/docx/createWordReport");
      const blob = await createWordReport(exportData, exportReport);
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

  const handleConfirmMapping = (mapping: ColumnMapping) => {
    if (!pendingCsv) return;
    try {
      const data = applyColumnMapping(pendingCsv.input, mapping);
      setPendingCsv(null);
      runImport("CSV 表格", () => {
        setImportError("");
        dispatch({ type: "import", data });
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "CSV 数据校验失败");
    }
  };

  const handleExportProject = async (inPlace = false) => {
    try {
      const snapshot = createProjectFile(
        state.baseline,
        state.draft,
        new Date().toISOString(),
        reportConfig,
      );
      const blob = bytesToBlob(new TextEncoder().encode(serialiseProjectFile(snapshot)), "application/json");
      const outcome = await saveBlob(blob, {
        suggestedName: PROJECT_FILE_FILENAME,
        filterName: "What-if 项目",
        extensions: ["json"],
        inPlace,
      });
      reportSave("项目文件", outcome);
      if (outcome.saved && outcome.filePath) trackDocument(outcome.filePath);
    } catch {
      setExportError("项目文件导出失败，请重试；当前项目未改变");
    }
  };

  /**
   * One importer for the file input and for drops. Desktop drops arrive as
   * bytes read by the main process, so both routes reduce to a File here.
   */
  const importDroppedFile = async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const document = await readProjectFile(file);
        runImport(file.name, () => {
          dispatch({ type: "importDocument", baseline: document.baseline, draft: document.draft });
          setReportConfig(normaliseReportConfig(document.config));
          setImportError("");
        });
        return;
      }
      const imported = await importTabularFile(file);
      if (imported.kind === "csv") {
        setPendingCsv({ input: imported.input, suggested: imported.suggested });
        setImportError("");
      } else {
        runImport(file.name, () => {
          setImportError("");
          dispatch({ type: "import", data: imported.data });
        });
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "文件导入失败，请检查文件后重试");
    }
  };

  /** Apply a project document that already arrived as text (desktop shell). */
  const applyProjectDocument = (text: string, filePath: string | null) => {
    try {
      const document = parseProjectFileText(text);
      runImport(filePath ? shortPath(filePath) : "项目文件", () => {
        dispatch({ type: "importDocument", baseline: document.baseline, draft: document.draft });
        setReportConfig(normaliseReportConfig(document.config));
        setImportError("");
        if (filePath) trackDocument(filePath);
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "项目文件导入失败");
    }
  };

  const handleImportProject = (file: File) => void importDroppedFile(file);

  const openProjectFromDisk = async () => {
    if (!desktop) return;
    const result = await desktop.openProject();
    if (result.canceled) {
      if (result.error) setImportError(result.error);
      return;
    }
    applyProjectDocument(result.text ?? "", result.filePath ?? null);
  };

  const openRecentProject = async (filePath: string) => {
    if (!desktop) return;
    const result = await desktop.openRecent(filePath);
    if (result.canceled) {
      if (result.error) setImportError(result.error);
      return;
    }
    applyProjectDocument(result.text ?? "", result.filePath ?? null);
  };

  const importSpreadsheetFromDisk = async () => {
    if (!desktop) return;
    const result = await desktop.openSpreadsheet();
    if (result.canceled) {
      if (result.error) setImportError(result.error);
      return;
    }
    try {
      const file = toFile(result.name ?? "import.xlsx", result.bytes ?? new Uint8Array());
      const imported = await importTabularFile(file);
      if (imported.kind === "csv") {
        setPendingCsv({ input: imported.input, suggested: imported.suggested });
        setImportError("");
      } else {
        runImport(file.name, () => {
          setImportError("");
          dispatch({ type: "import", data: imported.data });
        });
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "文件导入失败，请检查文件后重试");
    }
  };

  const cycleTheme = () => {
    const order: ThemeSetting[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(themeSetting) + 1) % order.length];
    void setTheme(next);
  };

  const notices = [
    storageWarning,
    hasUnappliedDraft
      ? exportSource === "draft"
        ? "导出草稿版本，包含尚未应用的修改；已确认基线保持不变"
        : "导出已确认版本，不包含未应用草稿；可在工具栏切换为草稿版"
      : "",
  ].filter((text): text is string => text !== "");

  const handleClear = () => {
    skipNextSave.current = true;
    try {
      clearProject();
    } catch {
      setStorageWarning("本地草稿清除失败，当前页面内仍可继续编辑和导出");
    }
    forgetCurrentFilePath();
    dispatch({ type: "clear" });
    setReportConfig(defaultConfig());
    setClearDialogOpen(false);
    setImportError("");
    setExportError("");
    setSaveNotice(null);
  };

  // Native menu commands reuse the exact handlers the toolbar buttons call, so
  // both routes behave identically. A ref keeps the subscription stable.
  const actionsRef = useRef({
    openProjectFromDisk,
    openRecentProject,
    handleExportProject,
    handleExportExcel,
    handleExportWord,
    importSpreadsheetFromDisk,
    requestClear: () => setClearDialogOpen(true),
  });
  actionsRef.current = {
    openProjectFromDisk,
    openRecentProject,
    handleExportProject,
    handleExportExcel,
    handleExportWord,
    importSpreadsheetFromDisk,
    requestClear: () => setClearDialogOpen(true),
  };

  useEffect(() => {
    if (!desktop) return undefined;
    applyDesktopShellChrome();
    return desktop.onMenuAction(({ action, filePath }) => {
      const actions = actionsRef.current;
      switch (action) {
        case "open-project":
          void actions.openProjectFromDisk();
          break;
        case "save-project":
          void actions.handleExportProject(true);
          break;
        case "export-excel":
          void actions.handleExportExcel();
          break;
        case "export-word":
          void actions.handleExportWord();
          break;
        case "import-spreadsheet":
          void actions.importSpreadsheetFromDisk();
          break;
        case "clear-project":
          actions.requestClear();
          break;
        case "open-recent":
          if (filePath) void actions.openRecentProject(filePath);
          break;
        default:
          break;
      }
    });
  }, [desktop]);

  const draggingFile = useFileDrop({
    onFile: (file) => void importDroppedFile(file),
    onError: setImportError,
  });

  return (
    <main className="app">
      {/* Draggable strip standing in for the hidden title bar (desktop only). */}
      <div className="desktop-shell-strip" aria-hidden="true" />
      {draggingFile ? (
        <div className="drop-overlay" role="status" aria-live="polite">
          松开以导入项目或表格文件
        </div>
      ) : null}

      <header className="app-header">
        <h1>What-if Report · 数据沙盘</h1>
        <p>导入固定格式 Excel，试改数值，预览指标与报告结论的变化。</p>
      </header>

      <FileImport
        onImport={(data: SalesData) => {
          runImport("表格文件", () => {
            setImportError("");
            dispatch({ type: "import", data });
          });
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
        onExportExcel={() => void handleExportExcel()}
        onExportWord={() => void handleExportWord()}
        exportSource={exportSource}
        onExportSourceChange={setExportSource}
        onExportProject={() => void handleExportProject()}
        onImportProject={handleImportProject}
        onOpenProjectFromDisk={desktop ? () => void openProjectFromDisk() : undefined}
        theme={themeSetting}
        onCycleTheme={cycleTheme}
      />
      <StatusMessage error={importError} exportError={exportError} notices={notices} />
      {saveNotice ? (
        <p role="status" className="status-notice save-notice">
          {saveNotice.message}
          {saveNotice.path && desktop ? (
            <button
              type="button"
              className="link-button"
              onClick={() => void desktop.revealPath(saveNotice.path!)}
            >
              在访达中显示
            </button>
          ) : null}
        </p>
      ) : null}
      <ConfirmClearDialog
        open={clearDialogOpen}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={handleClear}
      />
      <ConfirmImportDialog
        open={pendingImport !== null}
        fileName={pendingImport?.label}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          pendingImport?.apply();
          setPendingImport(null);
        }}
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

      <CloudPanel
        baseline={state.baseline}
        draft={state.draft}
        config={reportConfig}
        onOpenProject={(baseline, draft, config, onApplied) => {
          runImport("云端项目", () => {
            dispatch({ type: "importDocument", baseline, draft });
            setReportConfig(normaliseReportConfig(config));
            setImportError("");
            onApplied?.();
          });
        }}
      />

      <div className="ai-panel">
        <button type="button" onClick={() => setAiDialogOpen(true)}>
          AI 润色设置
        </button>
        <p className="hint">AI 仅润色文字,不参与数值计算;默认确定性模板,不需要网络。</p>
        {aiPolishedText ? (
          <div role="region" aria-label="AI 润色结果" className="ai-result">
            <h3>AI 润色结果(仅供参考,不改变报告数值)</h3>
            <p>{aiPolishedText}</p>
          </div>
        ) : null}
      </div>
      {aiDialogOpen ? (
        <AiPolishDialog
          report={baselineReport}
          onResult={(text) => {
            setAiPolishedText(text);
            setAiDialogOpen(false);
          }}
          onFallback={(message) => setExportError(message)}
          onClose={() => setAiDialogOpen(false)}
        />
      ) : null}

      <footer className="app-footer">
        {desktop
          ? "文件仅在本机处理：导入、计算与导出都不经过网络，断网也能完整使用。"
          : "文件仅在浏览器本地处理，不会上传到服务器；可在工具栏选择导出已确认版或草稿版。"}
        <DesktopFooter />
      </footer>
    </main>
  );
}
