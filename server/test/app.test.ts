import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";

const env: Env = {
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
  SERVE_STATIC: false,
  STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

let app: FastifyInstance | undefined;
let db: Db | undefined;

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function createApp() {
  db = openDatabase(":memory:");
  app = await buildApp({ env, db });
  await app.ready();
  return app;
}

describe("app integration", () => {
  it("answers health and readiness probes", async () => {
    const server = await createApp();
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json().status).toBe("ok");
    const ready = await server.inject({ method: "GET", url: "/ready" });
    expect(ready.json()).toMatchObject({ status: "ready", database: "ok" });
  });

  it("registers, protects /me and logs in via HTTP", async () => {
    const server = await createApp();
    const registered = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "http@test.dev", password: "password123", displayName: "HTTP" },
    });
    expect(registered.statusCode).toBe(200);
    const body = registered.json();
    expect(body.user.email).toBe("http@test.dev");
    expect(registered.cookies.find((c) => c.name === "refresh_token")?.httpOnly).toBe(true);

    const unauth = await server.inject({ method: "GET", url: "/api/auth/me" });
    expect(unauth.statusCode).toBe(401);
    expect(unauth.json().error.code).toBe("UNAUTHORIZED");

    const me = await server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.json().email).toBe("http@test.dev");

    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "http@test.dev", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
  });

  it("rejects invalid payloads with normalized field details", async () => {
    const server = await createApp();
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "bad-email", password: "short", displayName: "", extra: true },
    });
    expect(response.statusCode).toBe(400);
    const error = response.json().error;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: "email" })]));
    expect(error.requestId).toBeDefined();
  });

  it("serves the API docs only when they are enabled", async () => {
    const withDocs = await createApp();
    expect((await withDocs.inject({ method: "GET", url: "/api/docs/json" })).statusCode).toBe(200);

    await app?.close();
    app = await buildApp({ env: { ...env, API_DOCS: false } });
    await app.ready();
    // Embedded desktop builds turn the explorer off; it must not linger.
    expect((await app.inject({ method: "GET", url: "/api/docs/json" })).statusCode).toBe(404);
  });

  it("returns a normalized 404 for unknown routes", async () => {
    const server = await createApp();
    const response = await server.inject({ method: "GET", url: "/api/unknown" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");
  });
});
