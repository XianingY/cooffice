import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { makeRateLimitKey } from "../src/middleware/rateLimitKey.js";

function request(ip: string, headers: Record<string, string> = {}): FastifyRequest {
  return { ip, headers } as unknown as FastifyRequest;
}

describe("rate limit key", () => {
  it("keys on the socket address by default", () => {
    const key = makeRateLimitKey(false);
    expect(key(request("127.0.0.1", { "x-real-ip": "203.0.113.9" }))).toBe("127.0.0.1");
  });

  it("uses the proxy-supplied real IP when opted in", () => {
    const key = makeRateLimitKey(true);
    expect(key(request("172.18.0.5", { "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to the socket address when the header is missing", () => {
    expect(makeRateLimitKey(true)(request("172.18.0.5"))).toBe("172.18.0.5");
    expect(makeRateLimitKey(true)(request("172.18.0.5", { "x-real-ip": "" }))).toBe("172.18.0.5");
  });

  it("never trusts the client-controlled forwarded-for chain", () => {
    const key = makeRateLimitKey(true);
    expect(key(request("172.18.0.5", { "x-forwarded-for": "198.51.100.7, 203.0.113.9" }))).toBe("172.18.0.5");
  });
});
