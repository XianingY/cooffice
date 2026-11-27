import { useEffect, useMemo, useReducer, useState } from "react";
import {
  isProjectFileName,
  parseProjectFileText,
  readProjectFile,
} from "./adapters/storage/projectFileStorage";
import { importTabularFile } from "./adapters/tabular/importTabularFile";
import { AiPolishDialog } from "./components/AiPolishDialog";
import { ColumnMappingDialog } from "./components/ColumnMappingDialog";
import { CloudPanel } from "./components/CloudPanel";
import { ConfirmClearDialog } from "./components/ConfirmClearDialog";
import { ConfirmImportDialog } from "./components/ConfirmImportDialog";
import { DemoBar } from "./components/DemoBar";
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
import { buildReport, formatReportMarkdown } from "./core/report";
import { DEFAULT_REPORT_CONFIG, normaliseReportConfig } from "./core/reportConfig";
import {
  applyScenarioPreset,
  DEFAULT_TEMPLATE_ID,
  getScenarioTemplate,
  type ScenarioPreset,
  type ScenarioTemplate,
} from "./core/templates";
import type { ColumnMapping, ReportConfig, SalesData, TabularInput } from "./core/types";
import type { ThemeSetting } from "./desktop/bridge";
import {
  forgetCurrentFilePath,
  getDesktop,
  setDocumentEdited,
  shortPath,
  toFile,
  trackDocument,
} from "./desktop/bridge";
import { useDesktopMenu } from "./hooks/useDesktopMenu";
import { useFileDrop } from "./hooks/useFileDrop";
import { bootLocalProject, defaultReportConfig, useLocalPersistence } from "./hooks/useLocalPersistence";
import { useProjectExport } from "./hooks/useProjectExport";
import { salesDemo } from "./fixtures/salesDemo";
import { projectReducer } from "./state/projectReducer";
import { currentTheme, initTheme, setTheme, subscribeTheme } from "./theme";

export default function App() {
  const [boot] = useState(bootLocalProject);
  const [state, dispatch] = useReducer(projectReducer, boot.state);
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState<{ label: string; apply: () => void } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pendingCsv, setPendingCsv] = useState<{
    input: TabularInput;
    suggested: ColumnMapping;
  } | null>(null);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(boot.config);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPolishedText, setAiPolishedText] = useState("");
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>(() => currentTheme().setting);
  const [exportSource, setExportSource] = useState<ExportSource>("baseline");
  const [activeTemplateId, setActiveTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const desktop = useMemo(() => getDesktop(), []);
  const activeTemplate = useMemo(() => getScenarioTemplate(activeTemplateId), [activeTemplateId]);

  const { storageWarning, clearStorage } = useLocalPersistence(
    state.baseline,
    state.draft,
    reportConfig,
    boot.warning,
  );

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

  // Stale AI polished copy must not outlive the baseline or block config it was generated from.
  useEffect(() => {
    setAiPolishedText("");
  }, [state.baseline, reportConfig]);

  // macOS shows an unsaved-changes dot in the close button.
  useEffect(() => {
    setDocumentEdited(hasUnappliedDraft);
  }, [hasUnappliedDraft]);

  // One theme controller serves both shells; the shell decides where the
  // preference lives and this component only mirrors it for the toolbar.
  useEffect(() => {
    const unsubscribe = subscribeTheme((nextTheme) => setThemeSetting(nextTheme.setting));
    const teardown = initTheme();
    return () => {
      teardown();
      unsubscribe();
    };
  }, []);

  const exporter = useProjectExport({
    baseline: state.baseline,
    draft: state.draft,
    baselineReport,
    draftReport,
    reportConfig,
    exportSource,
  });

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

  /**
   * One importer for the file input and for drops. Desktop drops arrive as
   * bytes read by the main process, so both routes reduce to a File here.
   */
  const importDroppedFile = async (file: File, filePath?: string | null) => {
    try {
      if (isProjectFileName(file.name)) {
        const document = await readProjectFile(file);
        runImport(file.name, () => {
          dispatch({ type: "importDocument", baseline: document.baseline, draft: document.draft });
          setReportConfig(normaliseReportConfig(document.config));
          setImportError("");
          if (filePath) trackDocument(filePath);
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
    clearStorage();
    forgetCurrentFilePath();
    dispatch({ type: "clear" });
    setActiveTemplateId(DEFAULT_TEMPLATE_ID);
    setReportConfig(defaultReportConfig());
    setClearDialogOpen(false);
    setImportError("");
    exporter.clearExportNotices();
  };

  const handleSelectTemplate = (template: ScenarioTemplate) => {
    runImport(`示例场景「${template.name}」`, () => {
      dispatch({ type: "import", data: template.data });
      setActiveTemplateId(template.id);
      setImportError("");
    });
  };

  const handleApplyPreset = (preset: ScenarioPreset) => {
    const nextDraft = applyScenarioPreset(state.baseline, preset);
    const nextImpacts = compareSnapshots(state.baseline, nextDraft);
    const preferred =
      nextImpacts.find((item) => item.id === preset.highlightImpactId) ?? nextImpacts[0] ?? null;
    dispatch({
      type: "replaceDraft",
      draft: nextDraft,
      selectedImpactId: preferred?.id ?? null,
      sourceCells: preferred?.sourceCells ?? [],
    });
  };

  const handleCopyMarkdown = async () => {
    const targetData = exportSource === "draft" ? state.draft : state.baseline;
    const targetReport = exportSource === "draft" ? draftReport : baselineReport;
    const markdown = formatReportMarkdown(targetData, targetReport, exportSource);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      exporter.setExportError("剪贴板不可用，请改用「导出 Word」或手动复制");
    }
  };

  useDesktopMenu(desktop, {
    openProjectFromDisk,
    openRecentProject,
    handleExportProject: exporter.handleExportProject,
    handleExportExcel: exporter.handleExportExcel,
    handleExportWord: exporter.handleExportWord,
    importSpreadsheetFromDisk,
    requestClear: () => setClearDialogOpen(true),
  });

  const draggingFile = useFileDrop({
    onFile: (file, filePath) => void importDroppedFile(file, filePath),
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
        <p>导入 Excel / CSV 或试用内置场景，试改数值，即时预览指标、排名与报告结论变化。</p>
      </header>

      <DemoBar
        activeTemplate={activeTemplate}
        onSelectTemplate={handleSelectTemplate}
        onApplyPreset={handleApplyPreset}
      />

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
        onExportExcel={() => void exporter.handleExportExcel()}
        onExportWord={() => void exporter.handleExportWord()}
        exportSource={exportSource}
        onExportSourceChange={setExportSource}
        onExportProject={() => void exporter.handleExportProject()}
        onImportProject={(file) => void importDroppedFile(file)}
        onOpenProjectFromDisk={desktop ? () => void openProjectFromDisk() : undefined}
        theme={themeSetting}
        onCycleTheme={cycleTheme}
      />
      <StatusMessage error={importError} exportError={exporter.exportError} notices={notices} />
      {exporter.saveNotice ? (
        <p role="status" className="status-notice save-notice">
          {exporter.saveNotice.message}
          {exporter.saveNotice.path && desktop ? (
            <button
              type="button"
              className="link-button"
              onClick={() => void desktop.revealPath(exporter.saveNotice!.path!)}
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
          onCopyMarkdown={() => void handleCopyMarkdown()}
          copiedMarkdown={copiedMarkdown}
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
          onFallback={(message) => exporter.setExportError(message)}
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
