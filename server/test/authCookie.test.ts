import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";

const env: Env = {
  NODE_ENV: "test", HOST: "127.0.0.1", PORT: 0, LOG_LEVEL: "silent",
  JWT_SECRET: "integration-secret-long-enough-for-hs256",
  JWT_ACCESS_TTL: "15m", JWT_REFRESH_TTL: "30d", COOKIE_SECURE: true,
  DATABASE_PATH: ":memory:", CORS_ORIGINS: "http://localhost:5173",
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", TRUST_PROXY: false,
  API_DOCS: false, SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

describe("refresh cookie lifetime", () => {
  it("follows JWT_REFRESH_TTL instead of a hard-coded week", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "cookie@test.dev", password: "password123", displayName: "C" },
    });

    expect(response.statusCode).toBe(200);
    const cookie = response.headers["set-cookie"];
    const value = Array.isArray(cookie) ? cookie.join(";") : String(cookie);
    // 30 days, not the previous 7-day constant.
    expect(value).toContain("Max-Age=2592000");
    expect(value).toContain("HttpOnly");
    expect(value).toContain("Secure");
  });

  it("clears the refresh cookie with matching domain and security attributes on logout", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env: { ...env, COOKIE_DOMAIN: ".whatif.test" }, db });
    await app.ready();

    const response = await app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(response.statusCode).toBe(200);
    const cookie = response.headers["set-cookie"];
    const value = Array.isArray(cookie) ? cookie.join(";") : String(cookie);
    expect(value).toContain("Domain=.whatif.test");
    expect(value).toContain("Path=/api/auth");
    expect(value).toContain("HttpOnly");
    expect(value).toContain("Secure");
    expect(value).toContain("SameSite=Strict");
  });
});
