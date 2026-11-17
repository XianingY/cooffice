import { ApiClient } from "./client";
import { createApi, type Api } from "./endpoints";
import { tokenStore } from "../auth/tokenStore";
import { sessionHeaders } from "../desktop/bridge";

/**
 * Compose the API client at module scope so all components share one instance.
 * The refresh handler is injected separately to avoid an AuthProvider/API cycle.
 */
let refreshHandler: () => Promise<boolean> = async () => false;

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/**
 * In the desktop shell the renderer is served by the embedded API, so the
 * origin is the base URL and there is nothing to configure at build time.
 * A browser build still needs an explicit VITE_API_BASE_URL to opt in.
 */
const runtimeBase =
  typeof window !== "undefined" && window.desktop?.isDesktop === true && window.location.protocol.startsWith("http")
    ? window.location.origin
    : "";

/** Cloud features are disabled unless a backend URL is explicitly configured. */
export const cloudEnabled = runtimeBase.length > 0 || configuredBase.length > 0;
const baseUrl = runtimeBase || configuredBase;

const client = new ApiClient({
  baseUrl,
  getAccessToken: () => tokenStore.get(),
  getSessionHeaders: sessionHeaders,
  onUnauthorized: () => refreshHandler(),
});

export const api: Api = createApi(client);
