import { useState } from "react";
import { api, cloudEnabled } from "../api/factory";
import { useAuth } from "../auth/AuthProvider";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useCloudProject } from "../hooks/useCloudProject";
import type { ReportConfig, SalesData } from "../core/types";
import { AuthForms } from "./AuthForms";
import { ProfilePanel } from "./ProfilePanel";
import { ProjectList } from "./ProjectList";

interface CloudPanelProps {
  baseline: SalesData;
  draft: SalesData;
  config: ReportConfig;
  onOpenProject(baseline: SalesData, draft: SalesData, config: ReportConfig): void;
}

/** Optional cloud features: local-first editing never depends on this panel. */
export function CloudPanel({ baseline, draft, config, onOpenProject }: CloudPanelProps) {
  const { user, signOut, error } = useAuth();
  const online = useOnlineStatus();
  const cloud = useCloudProject(api);
  const [name, setName] = useState("未命名项目");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportError, setExportError] = useState("");

  const handleSave = async () => {
    await cloud.save(name, baseline, draft, config);
    setRefreshKey((key) => key + 1);
  };

  const handleExportFile = async () => {
    if (!cloud.projectId) return;
    try {
      const projectDocument = await api.projects.exportFile(cloud.projectId);
      const blob = new Blob([JSON.stringify(projectDocument, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "what-if-report-project.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "导出项目文件失败");
    }
  };

  const handleOpen = async (id: string) => {
    const project = await cloud.open(id);
    if (project) {
      onOpenProject(project.baseline, project.draft, project.config);
      setName(project.name);
    }
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
            <button type="button" onClick={() => void handleSave()} disabled={cloud.saving || !online}>
              {cloud.saving ? "保存中…" : cloud.projectId ? "更新云端项目" : "保存到云端"}
            </button>
          </div>
          {cloud.projectId ? (
            <button type="button" onClick={() => void handleExportFile()}>导出云项目文件</button>
          ) : null}
          {cloud.error || error || exportError ? (
            <p role="alert" className="status-error">{cloud.error || error || exportError}</p>
          ) : null}
          <ProfilePanel api={api} />
          <ProjectList api={api} onOpen={(id) => void handleOpen(id)} refreshKey={refreshKey} />
          <button type="button" onClick={() => void signOut()}>退出登录</button>
        </>
      )}
    </section>
  );
}
