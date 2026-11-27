import { useCallback, useState } from "react";
import type { Api, Project } from "../api/endpoints";
import { ApiError } from "../api/errors";
import type { ReportConfig, SalesData } from "../core/types";

export interface CloudProjectState {
  projectId: string | null;
  version: number | null;
  saving: boolean;
  error: string;
}

/**
 * Bridge between local editor state and the authenticated cloud API.
 * Updates send a single atomic PATCH carrying both baseline and draft plus the
 * last known version, preserving baseline/draft separation and enforcing
 * optimistic locking.
 */
export function useCloudProject(api: Api) {
  const [state, setState] = useState<CloudProjectState>({
    projectId: null,
    version: null,
    saving: false,
    error: "",
  });

  const save = useCallback(async (
    name: string,
    baseline: SalesData,
    draft: SalesData,
    config: ReportConfig,
    options?: { saveAsNew?: boolean },
  ): Promise<string | null> => {
    setState((previous) => ({ ...previous, saving: true, error: "" }));
    try {
      let project: Project;
      if (state.projectId && !options?.saveAsNew) {
        project = await api.projects.update(state.projectId, {
          name,
          baseline,
          draft,
          config,
          expectedVersion: state.version ?? undefined,
        });
      } else {
        project = await api.projects.create({ name, baseline, draft, config });
      }
      setState({ projectId: project.id, version: project.version, saving: false, error: "" });
      return project.id;
    } catch (error) {
      const message = error instanceof ApiError ? error.displayMessage : "保存失败，请稍后重试";
      setState((previous) => ({ ...previous, saving: false, error: message }));
      return null;
    }
  }, [api, state.projectId, state.version]);

  /**
   * Fetch a cloud project without binding it as the active save target yet.
   * Callers bind it only after any overwrite confirmation succeeds so
   * cancelling an import can never redirect future saves onto another project.
   */
  const fetchProject = useCallback(async (id: string): Promise<Project | null> => {
    setState((previous) => ({ ...previous, error: "" }));
    try {
      return await api.projects.get(id);
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof ApiError ? error.displayMessage : "打开失败" }));
      return null;
    }
  }, [api]);

  const bindProject = useCallback((project: Pick<Project, "id" | "version">) => {
    setState((previous) => ({ ...previous, projectId: project.id, version: project.version, error: "" }));
  }, []);

  const detach = useCallback(() => {
    setState((previous) => ({ ...previous, projectId: null, version: null }));
  }, []);

  return { ...state, save, fetchProject, bindProject, detach };
}
