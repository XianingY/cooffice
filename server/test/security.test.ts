import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";

const baseEnv: Env = {
  NODE_ENV: "test", HOST: "127.0.0.1", PORT: 0, LOG_LEVEL: "silent",
  JWT_SECRET: "integration-secret-long-enough-for-hs256",
  JWT_ACCESS_TTL: "15m", JWT_REFRESH_TTL: "7d", COOKIE_SECURE: false,
  DATABASE_PATH: ":memory:", CORS_ORIGINS: "http://localhost:5173",
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", TRUST_PROXY: false, API_DOCS: true, SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

async function boot(env: Env) {
  db = openDatabase(":memory:");
  app = await buildApp({ env, db });
  await app.ready();
  return app;
}

describe("security headers", () => {
  it("sets protective headers on API responses", async () => {
    const server = await boot(baseEnv);
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("does not send HSTS outside production", async () => {
    const server = await boot(baseEnv);
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("applies explicit CORS only to configured origins", async () => {
    const server = await boot(baseEnv);
    const allowed = await server.inject({ method: "GET", url: "/health", headers: { origin: "http://localhost:5173" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const denied = await server.inject({ method: "GET", url: "/health", headers: { origin: "http://evil.test" } });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows PUT preflight requests for cross-origin draft saves", async () => {
    const server = await boot(baseEnv);
    const preflight = await server.inject({
      method: "OPTIONS",
      url: "/api/projects/p1/draft",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "PUT",
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-methods"]).toContain("PUT");
  });
});
