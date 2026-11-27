import { useEffect, useState } from "react";
import type { Api, ProjectSummary } from "../api/endpoints";
import { ApiError } from "../api/errors";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 200;

interface ProjectListProps {
  api: Api;
  activeProjectId?: string | null;
  onOpen(id: string): void;
  onDeleted?(id: string): void;
  refreshKey?: number;
}

/** Cloud project browser with debounced search, pagination and safe deletion. */
export function ProjectList({
  api,
  activeProjectId = null,
  onOpen,
  onDeleted,
  refreshKey = 0,
}: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === debouncedSearch) return;
    const timer = setTimeout(() => {
      setOffset(0);
      setDebouncedSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.projects
      .list({ limit: PAGE_SIZE, offset, search: debouncedSearch || undefined })
      .then((response) => {
        if (!active) return;
        setProjects(response.items);
        setTotal(response.total);
        setError("");
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof ApiError ? cause.displayMessage : "无法加载项目列表");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, refreshKey, debouncedSearch, offset]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError("");
    try {
      await api.projects.remove(id);
      setConfirmDeleteId(null);
      setProjects((previous) => previous.filter((item) => item.id !== id));
      setTotal((previous) => Math.max(0, previous - 1));
      onDeleted?.(id);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.displayMessage : "删除项目失败");
    } finally {
      setDeletingId(null);
    }
  };

  const hasPrev = offset > 0;
  const hasNext = offset + projects.length < total;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="panel" aria-labelledby="projects-title">
      <h2 id="projects-title">云端项目</h2>
      <label>
        搜索项目
        <input
          aria-label="搜索项目"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="按名称过滤"
        />
      </label>
      {loading ? <p role="status">正在加载项目…</p> : null}
      {error ? <p role="alert" className="status-error">{error}</p> : null}
      {!loading && !error && projects.length === 0 ? (
        <p className="hint">{debouncedSearch ? "没有匹配的云端项目。" : "还没有云端项目。保存后可在这里打开。"}</p>
      ) : null}
      <ul className="project-list">
        {projects.map((project) => {
          const isActive = project.id === activeProjectId;
          const confirming = confirmDeleteId === project.id;
          return (
            <li key={project.id} className={isActive ? "project-item active" : "project-item"}>
              <button
                type="button"
                className="project-open"
                aria-current={isActive ? "true" : undefined}
                onClick={() => onOpen(project.id)}
              >
                <strong>{project.name}</strong>
                <small>
                  v{project.version} · {new Date(project.updatedAt).toLocaleString()}
                </small>
              </button>
              {confirming ? (
                <span className="project-delete-confirm">
                  <button
                    type="button"
                    className="danger"
                    disabled={deletingId === project.id}
                    onClick={() => void handleDelete(project.id)}
                  >
                    {deletingId === project.id ? "删除中…" : "确认删除"}
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteId(null)}>
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={`删除 ${project.name}`}
                  className="project-delete"
                  onClick={() => setConfirmDeleteId(project.id)}
                >
                  删除
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {total > PAGE_SIZE ? (
        <nav className="project-pagination" aria-label="项目分页">
          <button type="button" disabled={!hasPrev || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            上一页
          </button>
          <span className="hint">
            第 {currentPage} / {totalPages} 页（共 {total} 项）
          </span>
          <button type="button" disabled={!hasNext || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
            下一页
          </button>
        </nav>
      ) : null}
    </section>
  );
}
