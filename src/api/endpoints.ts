import type { ApiClient } from "./client";
import type { ReportConfig, SalesData } from "../core/types";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
}

export interface ProjectSummary {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project extends ProjectSummary {
  ownerId: string;
  baseline: SalesData;
  draft: SalesData;
  config: ReportConfig;
}

export interface ProjectList {
  items: ProjectSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReportResult {
  projectId: string;
  basis: "baseline" | "draft";
  metrics: {
    totalCurrent: number;
    totalPrevious: number;
    growthRate: number | null;
    topRegionId: string | null;
  };
  blocks: { id: string; text: string; sourceCells: string[] }[];
  chart: { title: string; unit: string; data: { regionId: string; name: string; value: number }[] };
  generatedAt: string;
}

/** Strongly typed API surface; components never build URLs themselves. */
export function createApi(client: ApiClient) {
  return {
    auth: {
      register: (body: { email: string; password: string; displayName: string }) =>
        client.request<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
      login: (body: { email: string; password: string }) =>
        client.request<TokenResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
      refresh: () => client.request<TokenResponse>("/api/auth/refresh", { method: "POST" }),
      logout: () => client.request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
      me: () => client.request<PublicUser>("/api/auth/me"),
    },
    projects: {
      list: (query: { limit?: number; offset?: number; sort?: string; order?: string } = {}) => {
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
        const suffix = params.toString() ? `?${params}` : "";
        return client.request<ProjectList>(`/api/projects${suffix}`);
      },
      create: (body: { name: string; baseline: SalesData; draft?: SalesData; config?: ReportConfig }) =>
        client.request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
      get: (id: string) => client.request<Project>(`/api/projects/${encodeURIComponent(id)}`),
      update: (id: string, body: Partial<{ name: string; config: ReportConfig; expectedVersion: number }>) =>
        client.request<Project>(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
      remove: (id: string) => client.request<void>(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
      saveDraft: (id: string, draft: SalesData) =>
        client.request<Project>(`/api/projects/${encodeURIComponent(id)}/draft`, { method: "PUT", body: JSON.stringify({ draft }) }),
      apply: (id: string) => client.request<Project>(`/api/projects/${encodeURIComponent(id)}/apply`, { method: "POST" }),
      revert: (id: string) => client.request<Project>(`/api/projects/${encodeURIComponent(id)}/revert`, { method: "POST" }),
    },
    reports: {
      generate: (id: string, useDraft = false) =>
        client.request<ReportResult>(`/api/projects/${encodeURIComponent(id)}/report${useDraft ? "?draft=true" : ""}`, { method: "POST" }),
      analytics: (id: string) =>
        client.request<{ confirmed: unknown; draft: unknown; hasUnappliedChanges: boolean }>(`/api/projects/${encodeURIComponent(id)}/analytics`),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
