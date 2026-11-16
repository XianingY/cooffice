import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../../src/api/client";
import { ApiError } from "../../src/api/errors";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeClient(fetchImpl: typeof fetch, getToken = () => "tok", onUnauthorized = async () => false) {
  return new ApiClient({ baseUrl: "http://api.test", getAccessToken: getToken, onUnauthorized, fetchImpl, maxRetries: 2 });
}

describe("ApiClient", () => {
  it("adds bearer token and returns parsed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ ok: true }));
    const result = await makeClient(fetchImpl).request<{ ok: boolean }>("/api/projects");
    expect(result).toEqual({ ok: true });
    const headers = fetchImpl.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("maps normalized server errors into ApiError with display message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json({ error: { code: "FORBIDDEN", message: "denied", requestId: "r1" } }, 403),
    );
    try {
      await makeClient(fetchImpl).request("/api/projects");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(403);
      expect(apiError.requestId).toBe("r1");
      expect(apiError.displayMessage).toContain("权限");
    }
  });

  it("retries 5xx up to the configured limit but never 4xx", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: "INTERNAL_ERROR", message: "e" } }, 500))
      .mockResolvedValueOnce(json({ ok: true }));
    expect(await makeClient(fetchImpl).request("/x")).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const bad = vi.fn().mockResolvedValue(json({ error: { code: "VALIDATION_ERROR", message: "bad" } }, 400));
    await expect(makeClient(bad).request("/x")).rejects.toBeInstanceOf(ApiError);
    expect(bad).toHaveBeenCalledTimes(1);
  });

  it("attempts one token refresh on 401 then retries", async () => {
    let token = "expired";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: "UNAUTHORIZED", message: "expired" } }, 401))
      .mockResolvedValueOnce(json({ ok: true }));
    const client = makeClient(fetchImpl, () => token, async () => { token = "fresh"; return true; });
    expect(await client.request("/api/auth/me")).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondHeaders = fetchImpl.mock.calls[1][1].headers as Headers;
    expect(secondHeaders.get("Authorization")).toBe("Bearer fresh");
  });

  it("does not refresh on auth endpoints and converts network failure", async () => {
    const unauth = vi.fn(async () => true);
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: { code: "UNAUTHORIZED", message: "bad" } }, 401));
    await expect(makeClient(fetchImpl, () => "t", unauth).request("/api/auth/login")).rejects.toBeInstanceOf(ApiError);
    expect(unauth).not.toHaveBeenCalled();

    const offline = makeClient(vi.fn().mockRejectedValue(new Error("offline")));
    await expect(offline.request("/x")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});
