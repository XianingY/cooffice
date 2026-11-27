import { useState } from "react";
import { api, cloudEnabled } from "../api/factory";
import { useAuth } from "../auth/AuthProvider";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useCloudProject } from "../hooks/useCloudProject";
import { useProjectEvents } from "../hooks/useProjectEvents";
import { saveBlob } from "../desktop/bridge";
import type { ReportConfig, SalesData } from "../core/types";
import { AuthForms } from "./AuthForms";
import { ProfilePanel } from "./ProfilePanel";
import { ProjectList } from "./ProjectList";

interface CloudPanelProps {
  baseline: SalesData;
  draft: SalesData;
  config: ReportConfig;
  onOpenProject(
    baseline: SalesData,
    draft: SalesData,
    config: ReportConfig,
    onApplied?: () => void,
  ): void;
}

/** Optional cloud features: local-first editing never depends on this panel. */
export function CloudPanel({ baseline, draft, config, onOpenProject }: CloudPanelProps) {
  const { user, signOut, error } = useAuth();
  const online = useOnlineStatus();
  const cloud = useCloudProject(api);
  const [name, setName] = useState("未命名项目");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportError, setExportError] = useState("");
  // The API publishes every successful mutation on this project, so a second
  // session (or another device) refreshes the list without a manual reload.
  const liveConnected = useProjectEvents(cloud.projectId, () => setRefreshKey((key) => key + 1));

  const handleSave = async (saveAsNew = false) => {
    const savedId = await cloud.save(name, baseline, draft, config, { saveAsNew });
    if (savedId) setRefreshKey((key) => key + 1);
  };

  const handleExportFile = async () => {
    if (!cloud.projectId) return;
    try {
      const projectDocument = await api.projects.exportFile(cloud.projectId);
      const blob = new Blob([JSON.stringify(projectDocument, null, 2)], { type: "application/json" });
      // Same save path as every other export: the desktop shell shows a native
      // dialog instead of silently dropping the file into the download folder.
      const outcome = await saveBlob(blob, {
        suggestedName: "what-if-report-project.json",
        filterName: "What-if 项目",
        extensions: ["json"],
      });
      if (!outcome.saved) setExportError(outcome.error ?? "");
      else setExportError("");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "导出项目文件失败");
    }
  };

  const handleOpen = async (id: string) => {
    const project = await cloud.fetchProject(id);
    if (project) {
      onOpenProject(project.baseline, project.draft, project.config, () => {
        cloud.bindProject(project);
        setName(project.name);
      });
    }
  };

  const handleDeleted = (deletedId: string) => {
    if (deletedId === cloud.projectId) {
      cloud.detach();
      setName("未命名项目");
    }
    setRefreshKey((key) => key + 1);
  };

  return (
    <section className="panel cloud-panel" aria-labelledby="cloud-title">
      <h2 id="cloud-title">云端同步(可选)</h2>
      {!cloudEnabled ? (
        <p className="hint">未配置后端地址,当前为纯本地模式。配置 VITE_API_BASE_URL 后可启用登录与云同步。</p>
      ) : !online ? (
        <p role="status" className="status-notice">当前离线,本地功能仍可使用。</p>
      ) : !user ? <AuthForms /> : (
        <>
          <p className="hint">已登录为 {user.email}</p>
          <div className="cloud-save">
            <label>
              项目名称
              <input aria-label="项目名称" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="button" onClick={() => void handleSave(false)} disabled={cloud.saving || !online}>
              {cloud.saving ? "保存中…" : cloud.projectId ? "更新云端项目" : "保存到云端"}
            </button>
            {cloud.projectId ? (
              <button type="button" onClick={() => void handleSave(true)} disabled={cloud.saving || !online}>
                另存为新项目
              </button>
            ) : null}
          </div>
          {cloud.projectId ? (
            <>
              <button type="button" onClick={() => void handleExportFile()}>导出云项目文件</button>
              {liveConnected ? (
                <p className="hint" aria-live="polite">实时同步已连接</p>
              ) : null}
            </>
          ) : null}
          {cloud.error || error || exportError ? (
            <p role="alert" className="status-error">{cloud.error || error || exportError}</p>
          ) : null}
          <ProfilePanel api={api} />
          <ProjectList
            api={api}
            activeProjectId={cloud.projectId}
            onOpen={(id) => void handleOpen(id)}
            onDeleted={handleDeleted}
            refreshKey={refreshKey}
          />
          <button type="button" onClick={() => void signOut()}>退出登录</button>
        </>
      )}
    </section>
  );
}
