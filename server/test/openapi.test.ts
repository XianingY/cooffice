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
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", API_DOCS: true, SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

describe("OpenAPI documentation", () => {
  it("serves an OpenAPI 3.1 document describing all feature areas", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/api/docs/json" });
    expect(response.statusCode).toBe(200);
    const doc = response.json();
    expect(doc.openapi).toMatch(/^3\.1/);
    expect(doc.info.title).toBe("What-if Report API");
    // Tracks server/package.json; the document itself reads the manifest.
    expect(doc.info.version).toBe("1.5.0");
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining([
      "/api/auth/login",
      "/api/projects",
      "/api/projects/{id}/report",
    ]));
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });
});
