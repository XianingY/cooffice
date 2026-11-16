import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";

const env: Env = {
  NODE_ENV: "test", HOST: "127.0.0.1", PORT: 0, LOG_LEVEL: "silent",
  JWT_SECRET: "integration-secret-long-enough-for-hs256",
  JWT_ACCESS_TTL: "15m", JWT_REFRESH_TTL: "7d", COOKIE_SECURE: false,
  DATABASE_PATH: ":memory:", CORS_ORIGINS: "http://localhost:5173",
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

async function tokenFor(email: string) {
  const response = await app!.inject({
    method: "POST", url: "/api/auth/register",
    payload: { email, password: "password123", displayName: "T" },
  });
  return response.json().accessToken as string;
}

describe("audit routes", () => {
  it("denies audit access to regular users", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.ready();
    const token = await tokenFor("user@test.dev");
    const response = await app.inject({
      method: "GET", url: "/api/admin/audit?entity=auth",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  it("lets admins read audit entries and validates query", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.ready();
    // Register, promote in DB, then log in again so the token carries admin role.
    await tokenFor("admin@test.dev");
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run("admin@test.dev");
    const login = await app.inject({
      method: "POST", url: "/api/auth/login",
      payload: { email: "admin@test.dev", password: "password123" },
    });
    const token = login.json().accessToken as string;

    const response = await app.inject({
      method: "GET", url: "/api/admin/audit?entity=auth&limit=10",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().items)).toBe(true);

    const invalid = await app.inject({
      method: "GET", url: "/api/admin/audit?entity=unknown",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(invalid.statusCode).toBe(400);
  });
});
