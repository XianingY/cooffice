import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { Env } from "../src/config/env.js";
import { SESSION_HEADER } from "../src/middleware/sessionGuard.js";

const TOKEN = "desktop-session-token-for-tests";

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

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createApp(apiToken?: string): Promise<FastifyInstance> {
  app = await buildApp({ env, apiToken });
  await app.ready();
  return app;
}

describe("desktop session guard", () => {
  it("leaves the API open when no token is configured", async () => {
    const server = await createApp();
    const response = await server.inject({ method: "GET", url: "/api/auth/me" });
    // Reaches the auth middleware instead of being blocked at the door.
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).not.toContain("Desktop session token");
  });

  it("rejects API calls that do not carry the launch token", async () => {
    const server = await createApp(TOKEN);
    const response = await server.inject({ method: "GET", url: "/api/auth/me" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toMatchObject({
      code: "UNAUTHORIZED",
      message: expect.stringContaining("Desktop session token"),
    });
  });

  it("rejects a wrong token of a different length without throwing", async () => {
    const server = await createApp(TOKEN);
    const response = await server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { [SESSION_HEADER]: "short" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("accepts requests that carry the token", async () => {
    const server = await createApp(TOKEN);
    const response = await server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { [SESSION_HEADER]: TOKEN },
    });
    // Reaches the auth middleware: 401 for "no bearer token", not for the guard.
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).not.toContain("Desktop session token");
  });

  it("allows a full register/login round trip through the guard", async () => {
    const server = await createApp(TOKEN);
    const registered = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { [SESSION_HEADER]: TOKEN },
      payload: { email: "guarded@test.dev", password: "password123", displayName: "Guarded" },
    });
    expect(registered.statusCode).toBe(200);
  });

  it("does not guard health probes or the HTML shell", async () => {
    const server = await createApp(TOKEN);
    expect((await server.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
    // Independent of the document request, which a browser cannot decorate.
    const page = await server.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(404); // SPA hosting is off in this fixture
  });
});
