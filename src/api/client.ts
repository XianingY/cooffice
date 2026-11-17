import { ApiError, networkError } from "./errors";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken(): string | null;
  /** Extra headers required by the desktop shell (empty in the browser). */
  getSessionHeaders?(): Record<string, string>;
  onUnauthorized(): Promise<boolean>;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string; requestId?: string; details?: unknown };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Typed fetch client: adds bearer tokens, retries only transient 5xx/network
 * failures (max 3), and attempts one token refresh on 401 without retrying
 * 4xx. Credentials are included so the HttpOnly refresh cookie is sent.
 */
export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const doFetch = this.options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const maxRetries = this.options.maxRetries ?? 3;
    let refreshed = false;

    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await doFetch(`${this.options.baseUrl}${path}`, {
          ...init,
          credentials: "include",
          headers: this.buildHeaders(init.headers, init.body !== undefined),
        });
      } catch {
        if (attempt < maxRetries) {
          await sleep(2 ** attempt * 200);
          continue;
        }
        throw networkError();
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      const error = await this.toApiError(response);
      const isAuthFlow = path === "/api/auth/login" || path === "/api/auth/register" || path === "/api/auth/refresh";
      if (error.status === 401 && !refreshed && !isAuthFlow) {
        refreshed = true;
        const recovered = await this.options.onUnauthorized();
        if (recovered) continue;
      }
      // Retry transient server errors with capped exponential backoff.
      if (error.status >= 500 && attempt < maxRetries) {
        await sleep(2 ** attempt * 200);
        continue;
      }
      throw error;
    }
  }

  private buildHeaders(input: HeadersInit | undefined, hasBody: boolean): HeadersInit {
    const headers = new Headers(input);
    if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const token = this.options.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    for (const [name, value] of Object.entries(this.options.getSessionHeaders?.() ?? {})) {
      headers.set(name, value);
    }
    return headers;
  }

  private async toApiError(response: Response): Promise<ApiError> {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // Non-JSON error body: use status-derived defaults.
    }
    return new ApiError(
      response.status,
      body.error?.code ?? `HTTP_${response.status}`,
      body.error?.message ?? response.statusText,
      body.error?.requestId,
      body.error?.details,
    );
  }
}
