import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";

const lowLimitEnv: Env = {
  NODE_ENV: "test", HOST: "127.0.0.1", PORT: 0, LOG_LEVEL: "silent",
  JWT_SECRET: "integration-secret-long-enough-for-hs256",
  JWT_ACCESS_TTL: "15m", JWT_REFRESH_TTL: "7d", COOKIE_SECURE: false,
  DATABASE_PATH: ":memory:", CORS_ORIGINS: "http://localhost:5173",
  RATE_LIMIT_MAX: 2, RATE_LIMIT_WINDOW: "1m", API_DOCS: true, SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

describe("rate limiting", () => {
  it("rejects requests beyond the configured global limit with normalized error", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env: lowLimitEnv, db });
    await app.ready();

    const first = await app.inject({ method: "GET", url: "/health" });
    const second = await app.inject({ method: "GET", url: "/health" });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const third = await app.inject({ method: "GET", url: "/health" });
    expect(third.statusCode).toBe(429);
    expect(third.json().error.code).toBe("RATE_LIMITED");
    expect(third.headers["retry-after"]).toBeDefined();
  });
});
