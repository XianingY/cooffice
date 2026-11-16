import { useState } from "react";
import { api } from "../api/factory";
import { useAuth } from "../auth/AuthProvider";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useCloudProject } from "../hooks/useCloudProject";
import type { ReportConfig, SalesData } from "../core/types";
import { AuthForms } from "./AuthForms";
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

  const handleSave = async () => {
    await cloud.save(name, baseline, draft, config);
    setRefreshKey((key) => key + 1);
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
      {!online ? <p role="status" className="status-notice">当前离线,本地功能仍可使用。</p> : null}
      {!user ? <AuthForms /> : (
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
          {cloud.error || error ? <p role="alert" className="status-error">{cloud.error || error}</p> : null}
          <ProjectList api={api} onOpen={(id) => void handleOpen(id)} refreshKey={refreshKey} />
          <button type="button" onClick={() => void signOut()}>退出登录</button>
        </>
      )}
    </section>
  );
}
