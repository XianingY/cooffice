import { useEffect, useState } from "react";
import type { Api, ProjectSummary } from "../api/endpoints";
import { ApiError } from "../api/errors";

interface ProjectListProps {
  api: Api;
  onOpen(id: string): void;
  refreshKey?: number;
}

/** Cloud project browser; local work continues to work without a session. */
export function ProjectList({ api, onOpen, refreshKey = 0 }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.projects.list({ limit: 50 })
      .then((response) => { if (active) { setProjects(response.items); setError(""); } })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiError ? cause.displayMessage : "无法加载项目列表");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, refreshKey]);

  return (
    <section className="panel" aria-labelledby="projects-title">
      <h2 id="projects-title">云端项目</h2>
      {loading ? <p role="status">正在加载项目…</p> : null}
      {error ? <p role="alert" className="status-error">{error}</p> : null}
      {!loading && !error && projects.length === 0 ? <p className="hint">还没有云端项目。保存后可在这里打开。</p> : null}
      <ul className="project-list">
        {projects.map((project) => (
          <li key={project.id}>
            <button type="button" onClick={() => onOpen(project.id)}>
              <strong>{project.name}</strong>
              <small>{new Date(project.updatedAt).toLocaleString()}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
