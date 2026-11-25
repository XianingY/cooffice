import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { Env } from "../src/config/env.js";
import { SPA_CSP } from "../src/static/spa.js";

let staticDir: string;
let app: FastifyInstance | undefined;

function createStaticDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "whatif-spa-"));
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<!doctype html><div id=\"root\"></div>");
  writeFileSync(join(dir, "assets", "app-abc123.js"), "console.log('bundle');");
  return dir;
}

function envFor(): Env {
  return {
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: 0,
    LOG_LEVEL: "silent",
    JWT_SECRET: "integration-secret-long-enough-for-hs256",
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    COOKIE_SECURE: false,
    DATABASE_PATH: ":memory:",
    CORS_ORIGINS: "http://localhost:5173",
    RATE_LIMIT_MAX: 1000,
    RATE_LIMIT_WINDOW: "1m", TRUST_PROXY: false,
    API_DOCS: true,
    SERVE_STATIC: true,
    STATIC_DIR: staticDir,
    corsOriginList: ["http://localhost:5173"],
  };
}

beforeEach(() => {
  staticDir = createStaticDir();
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(staticDir, { recursive: true, force: true });
});

async function createApp(): Promise<FastifyInstance> {
  app = await buildApp({ env: envFor() });
  await app.ready();
  return app;
}

describe("static SPA hosting", () => {
  it("serves index.html at the root with a strict CSP", async () => {
    const server = await createApp();
    const response = await server.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain('id="root"');
    expect(response.headers["content-security-policy"]).toBe(SPA_CSP);
    expect(response.headers["cache-control"]).toBe("no-cache");
  });

  it("caches content-hashed assets immutably", async () => {
    const server = await createApp();
    const response = await server.inject({ method: "GET", url: "/assets/app-abc123.js" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("falls back to the shell for client-side deep links", async () => {
    const server = await createApp();
    const response = await server.inject({ method: "GET", url: "/projects/42?tab=draft" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('id="root"');
  });

  it("keeps the JSON error contract for unknown API routes", async () => {
    const server = await createApp();
    for (const url of ["/api/unknown", "/health/extra"]) {
      const response = await server.inject({ method: "GET", url });
      expect(response.statusCode).toBe(404);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json().error.code).toBe("NOT_FOUND");
    }
  });

  it("still answers real API routes next to the SPA catch-all", async () => {
    const server = await createApp();
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json().status).toBe("ok");
  });

  it("fails loudly when the build output is missing", async () => {
    rmSync(join(staticDir, "index.html"));
    await expect(buildApp({ env: envFor() })).rejects.toThrow(/missing index\.html/);
  });
});
