import { describe, expect, it } from "vitest";
import { requestIdHook } from "../src/middleware/requestContext.js";

function fakeRequest(headers: Record<string, unknown> = {}): { requestId?: string; headers: Record<string, unknown> } {
  return { headers };
}

describe("requestIdHook", () => {
  it("assigns a generated id when none is supplied", () => {
    const request = fakeRequest();
    requestIdHook(request as never, {} as never, () => {});
    expect(request.requestId).toMatch(/^[\da-f-]{36}$/);
  });

  it("honors a well-formed inbound request id", () => {
    const request = fakeRequest({ "x-request-id": "client-correlation-123" });
    requestIdHook(request as never, {} as never, () => {});
    expect(request.requestId).toBe("client-correlation-123");
  });

  it("ignores malformed or injected ids", () => {
    for (const value of ["short", "../etc/passwd", "a".repeat(100)]) {
      const request = fakeRequest({ "x-request-id": value });
      requestIdHook(request as never, {} as never, () => {});
      expect(request.requestId).not.toBe(value);
    }
  });
});
