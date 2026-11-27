import { ApiClient } from "./client";
import { createApi, type Api } from "./endpoints";
import { tokenStore } from "../auth/tokenStore";
import { sessionHeaders } from "../desktop/bridge";

/**
 * Compose the API client at module scope so all components share one instance.
 * The refresh handler is injected separately to avoid an AuthProvider/API cycle
 * and deduplicated so concurrent 401s (including SSE) never replay a rotated
 * refresh token.
 */
let refreshHandler: () => Promise<boolean> = async () => false;
let refreshInFlight: Promise<boolean> | null = null;
const sessionExpiredListeners = new Set<() => void>();

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) listener();
}

/** Shared single-flight refresh used by both ApiClient and SSE reconnects. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = Promise.resolve()
      .then(() => refreshHandler())
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Normalise VITE_API_BASE_URL so same-origin proxy deployments (`/` or `/api`)
 * never produce double `/api/api/...` URLs when combined with endpoint paths
 * that already start with `/api/`.
 */
export function resolveApiConfig(
  configured: string | undefined,
  runtimeBase = "",
): { cloudEnabled: boolean; baseUrl: string } {
  const runtime = runtimeBase.trim().replace(/\/+$/, "");
  if (runtime.length > 0) return { cloudEnabled: true, baseUrl: runtime };

  const raw = (configured ?? "").trim();
  if (raw.length === 0) return { cloudEnabled: false, baseUrl: "" };

  const stripped = raw.replace(/\/+$/, "");
  if (stripped === "" || stripped === "/api") {
    return { cloudEnabled: true, baseUrl: "" };
  }
  const baseUrl = stripped.endsWith("/api") ? stripped.slice(0, -4) : stripped;
  return { cloudEnabled: true, baseUrl };
}

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

/**
 * In the desktop shell the renderer is served by the embedded API, so the
 * origin is the base URL and there is nothing to configure at build time.
 * A browser build still needs an explicit VITE_API_BASE_URL to opt in.
 */
const runtimeBase =
  typeof window !== "undefined" && window.desktop?.isDesktop === true && window.location.protocol.startsWith("http")
    ? window.location.origin
    : "";

const resolved = resolveApiConfig(configuredBase, runtimeBase);

/** Cloud features are disabled unless a backend URL is explicitly configured. */
export const cloudEnabled = resolved.cloudEnabled;
const baseUrl = resolved.baseUrl;

/** Absolute URL for a path on the configured API, used by fetch-based SSE. */
export function apiUrl(path: string): string {
  return `${baseUrl}${path}`;
}

const client = new ApiClient({
  baseUrl,
  getAccessToken: () => tokenStore.get(),
  getSessionHeaders: sessionHeaders,
  onUnauthorized: () => refreshSession(),
});

export const api: Api = createApi(client);
