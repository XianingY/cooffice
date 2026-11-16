import { ApiClient } from "./client";
import { createApi, type Api } from "./endpoints";
import { tokenStore } from "../auth/tokenStore";

/**
 * Compose the API client at module scope so all components share one instance.
 * The refresh handler is injected separately to avoid an AuthProvider/API cycle.
 */
let refreshHandler: () => Promise<boolean> = async () => false;

export function setRefreshHandler(handler: () => Promise<boolean>): void {
  refreshHandler = handler;
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const client = new ApiClient({
  baseUrl,
  getAccessToken: () => tokenStore.get(),
  onUnauthorized: () => refreshHandler(),
});

export const api: Api = createApi(client);
