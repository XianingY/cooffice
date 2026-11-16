import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { clearProject, loadProject, saveProject } from "./adapters/storage/projectStorage";
import { ConfirmClearDialog } from "./components/ConfirmClearDialog";
import { FileImport } from "./components/FileImport";
import { ImpactList } from "./components/ImpactList";
import { ReportPreview } from "./components/ReportPreview";
import { SalesTable } from "./components/SalesTable";
import { StatusMessage } from "./components/StatusMessage";
import { Toolbar } from "./components/Toolbar";
import { compareSnapshots } from "./core/impacts";
import { computeMetrics } from "./core/metrics";
import { buildReport } from "./core/report";
import type { SalesData } from "./core/types";
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
    () => buildReport(state.baseline, baselineMetrics),
    [state.baseline, baselineMetrics],
  );
  const draftReport = useMemo(() => buildReport(state.draft, draftMetrics), [state.draft, draftMetrics]);
  const impacts = useMemo(
    () => compareSnapshots(state.baseline, state.draft),
    [state.baseline, state.draft],
  );
  const hasUnappliedDraft = useMemo(
    () => JSON.stringify(state.baseline) !== JSON.stringify(state.draft),
    [state.baseline, state.draft],
  );

  const handleClear = () => {
    skipNextSave.current = true;
    try {
      clearProject();
    } catch {
      setStorageWarning("本地草稿清除失败，当前页面内仍可继续编辑和导出");
    }
    dispatch({ type: "clear" });
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
        onError={setImportError}
      />
      <Toolbar
        hasUnappliedDraft={hasUnappliedDraft}
        onApply={() => dispatch({ type: "apply" })}
        onRevert={() => dispatch({ type: "revert" })}
        onClear={() => setClearDialogOpen(true)}
      />
      <StatusMessage error={importError} exportError={exportError} notice={storageWarning} />
      <ConfirmClearDialog
        open={clearDialogOpen}
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={handleClear}
      />

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

      <footer className="app-footer">
        文件仅在浏览器本地处理，不会上传到服务器；导出始终使用已确认版本。
      </footer>
    </main>
  );
}
