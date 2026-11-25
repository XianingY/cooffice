import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

const base = {
  JWT_SECRET: "a-long-random-development-secret-value",
  NODE_ENV: "development",
};

describe("loadEnv", () => {
  it("returns validated config with parsed CORS origins and booleans", () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: "http://a.test, http://b.test", COOKIE_SECURE: "true", PORT: "4000" });
    expect(env.corsOriginList).toEqual(["http://a.test", "http://b.test"]);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_PATH).toBe("./data/whatif.db");
    expect(env.TRUST_PROXY).toBe(false);
  });

  it("enables proxy-aware rate-limit keys only via an explicit flag", () => {
    expect(loadEnv({ ...base, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true);
    expect(loadEnv({ ...base, TRUST_PROXY: "1" }).TRUST_PROXY).toBe(true);
    expect(loadEnv({ ...base, TRUST_PROXY: "false" }).TRUST_PROXY).toBe(false);
  });

  it("fails fast on a short JWT secret", () => {
    expect(() => loadEnv({ JWT_SECRET: "short" })).toThrow("JWT_SECRET");
  });

  it("rejects wildcard CORS and placeholder secret in production", () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", CORS_ORIGINS: "*" }),
    ).toThrow("CORS_ORIGINS");
    expect(() =>
      loadEnv({ JWT_SECRET: "dev-only-placeholder-secret", NODE_ENV: "production" }),
    ).toThrow("JWT_SECRET");
  });

  it("rejects a malformed TTL", () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_TTL: "forever" })).toThrow("JWT_ACCESS_TTL");
  });
});
