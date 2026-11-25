import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";
import { parseProjectDocument } from "../src/modules/projects/projectFile.js";

const env: Env = {
  NODE_ENV: "test", HOST: "127.0.0.1", PORT: 0, LOG_LEVEL: "silent",
  JWT_SECRET: "integration-secret-long-enough-for-hs256",
  JWT_ACCESS_TTL: "15m", JWT_REFRESH_TTL: "7d", COOKIE_SECURE: false,
  DATABASE_PATH: ":memory:", CORS_ORIGINS: "http://localhost:5173",
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", TRUST_PROXY: false, API_DOCS: true, SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};
const data = { regions: [{ id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" }] };
const document = {
  format: "what-if-report-project",
  version: 1,
  name: "Imported",
  baseline: data,
  draft: data,
  config: { blocks: ["summary"] },
};

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

async function setup() {
  db = openDatabase(":memory:");
  app = await buildApp({ env, db });
  await app.ready();
  const auth = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "f@test.dev", password: "password123", displayName: "F" } });
  return { server: app, headers: { authorization: `Bearer ${auth.json().accessToken}` } };
}

describe("project document validation", () => {
  it("accepts a valid document and rejects unknown fields", () => {
    expect(parseProjectDocument(document)).toMatchObject({ name: "Imported" });
    expect(() => parseProjectDocument({ ...document, injected: true })).toThrow();
  });
});

describe("project file routes", () => {
  it("exports a project without owner data", async () => {
    const { server, headers } = await setup();
    const created = await server.inject({ method: "POST", url: "/api/projects", headers, payload: { name: "P", baseline: data } });
    const id = created.json().id as string;
    const response = await server.inject({ method: "GET", url: `/api/projects/${id}/file`, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ format: "what-if-report-project", version: 1, name: "P" });
    expect(response.json()).not.toHaveProperty("ownerId");
    expect(response.headers["content-disposition"]).toContain("what-if-report-project.json");
  });

  it("imports a valid document and rejects malformed ones", async () => {
    const { server, headers } = await setup();
    const imported = await server.inject({
      method: "POST", url: "/api/projects/import", headers, payload: { document },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().name).toBe("Imported");

    const rejected = await server.inject({
      method: "POST", url: "/api/projects/import", headers, payload: { document: { ...document, version: 99 } },
    });
    expect(rejected.statusCode).toBe(400);
  });
});
