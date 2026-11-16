import { useCallback, useState } from "react";
import type { Api, Project } from "../api/endpoints";
import { ApiError } from "../api/errors";
import type { ReportConfig, SalesData } from "../core/types";

export interface CloudProjectState {
  projectId: string | null;
  saving: boolean;
  error: string;
}

/** Bridge between local editor state and the authenticated cloud API. */
export function useCloudProject(api: Api) {
  const [state, setState] = useState<CloudProjectState>({ projectId: null, saving: false, error: "" });

  const save = useCallback(async (
    name: string,
    baseline: SalesData,
    draft: SalesData,
    config: ReportConfig,
  ): Promise<string | null> => {
    setState((previous) => ({ ...previous, saving: true, error: "" }));
    try {
      let project: Project;
      if (state.projectId) {
        // Persist draft first, then promote it to the confirmed baseline.
        await api.projects.saveDraft(state.projectId, draft);
        await api.projects.update(state.projectId, { name, config });
        project = await api.projects.apply(state.projectId);
      } else {
        project = await api.projects.create({ name, baseline, draft, config });
      }
      setState({ projectId: project.id, saving: false, error: "" });
      return project.id;
    } catch (error) {
      const message = error instanceof ApiError ? error.displayMessage : "保存失败，请稍后重试";
      setState((previous) => ({ ...previous, saving: false, error: message }));
      return null;
    }
  }, [api, state.projectId]);

  const open = useCallback(async (id: string): Promise<Project | null> => {
    setState((previous) => ({ ...previous, error: "" }));
    try {
      const project = await api.projects.get(id);
      setState((previous) => ({ ...previous, projectId: project.id }));
      return project;
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof ApiError ? error.displayMessage : "打开失败" }));
      return null;
    }
  }, [api]);

  return { ...state, save, open, setProjectId: (id: string | null) => setState((p) => ({ ...p, projectId: id })) };
}
