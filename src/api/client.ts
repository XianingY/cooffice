import { ApiError, networkError } from "./errors";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken(): string | null;
  /** Extra headers required by the desktop shell (empty in the browser). */
  getSessionHeaders?(): Record<string, string>;
  onUnauthorized(): Promise<boolean>;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Per-attempt timeout in milliseconds; 0 disables the timeout. */
  timeoutMs?: number;
}

interface ErrorBody {
  error?: { code?: string; message?: string; requestId?: string; details?: unknown };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

function isIdempotent(method: string | undefined): boolean {
  return IDEMPOTENT_METHODS.has((method ?? "GET").toUpperCase());
}

/**
 * Typed fetch client: adds bearer tokens, retries transient 5xx/network
 * failures only for idempotent methods (max 3), enforces a per-attempt
 * timeout, and single-flights 401 token refreshes so concurrent expired
 * requests cannot trigger refresh-token reuse revocation.
 */
export class ApiClient {
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const doFetch = this.options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const maxRetries = this.options.maxRetries ?? 3;
    const timeoutMs = this.options.timeoutMs ?? 15_000;
    const canRetry = isIdempotent(init.method);
    let refreshed = false;

    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      const controller = timeoutMs > 0 ? new AbortController() : null;
      const onCallerAbort = () => controller?.abort();
      if (controller && init.signal) {
        if (init.signal.aborted) controller.abort();
        else init.signal.addEventListener("abort", onCallerAbort, { once: true });
      }
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        response = await doFetch(`${this.options.baseUrl}${path}`, {
          ...init,
          signal: controller ? controller.signal : init.signal,
          credentials: "include",
          headers: this.buildHeaders(init.headers, init.body !== undefined),
        });
      } catch {
        if (canRetry && attempt < maxRetries && !init.signal?.aborted) {
          await sleep(2 ** attempt * 200);
          continue;
        }
        throw networkError();
      } finally {
        if (timer !== null) clearTimeout(timer);
        if (controller && init.signal) init.signal.removeEventListener("abort", onCallerAbort);
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      const error = await this.toApiError(response);
      const isAuthFlow = path === "/api/auth/login" || path === "/api/auth/register" || path === "/api/auth/refresh";
      if (error.status === 401 && !refreshed && !isAuthFlow) {
        refreshed = true;
        const recovered = await this.runSingleFlightRefresh();
        if (recovered) continue;
      }
      // Retry transient server errors only on idempotent methods.
      if (canRetry && error.status >= 500 && attempt < maxRetries) {
        await sleep(2 ** attempt * 200);
        continue;
      }
      throw error;
    }
  }

  private runSingleFlightRefresh(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = Promise.resolve()
        .then(() => this.options.onUnauthorized())
        .finally(() => {
          this.refreshInFlight = null;
        });
    }
    return this.refreshInFlight;
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
