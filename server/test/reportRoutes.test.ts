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
const data = { regions: [{ id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" }] };

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

async function setup() {
  db = openDatabase(":memory:");
  app = await buildApp({ env, db });
  await app.ready();
  const auth = await app.inject({
    method: "POST", url: "/api/auth/register",
    payload: { email: "r@test.dev", password: "password123", displayName: "R" },
  });
  const token = auth.json().accessToken as string;
  const project = await app.inject({
    method: "POST", url: "/api/projects", headers: { authorization: `Bearer ${token}` },
    payload: { name: "P", baseline: data },
  });
  return { server: app, token, id: project.json().id as string };
}

describe("report routes", () => {
  it("generates a report from baseline by default", async () => {
    const { server, token, id } = await setup();
    const response = await server.inject({
      method: "POST", url: `/api/projects/${id}/report`, headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().basis).toBe("baseline");
    expect(response.json().metrics.totalCurrent).toBe(120);
    expect(response.json().blocks[0].text).toContain("120 万元");
    expect(response.json().chart.data[0].name).toBe("华东");
  });

  it("optionally generates from draft", async () => {
    const { server, token, id } = await setup();
    const edited = structuredClone(data);
    edited.regions[0].current = 90;
    await server.inject({
      method: "PUT", url: `/api/projects/${id}/draft`, headers: { authorization: `Bearer ${token}` },
      payload: { draft: edited },
    });
    const response = await server.inject({
      method: "POST", url: `/api/projects/${id}/report?draft=true`, headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().basis).toBe("draft");
    expect(response.json().metrics.totalCurrent).toBe(90);
  });

  it("returns analytics with unapplied-change flag", async () => {
    const { server, token, id } = await setup();
    const response = await server.inject({
      method: "GET", url: `/api/projects/${id}/analytics`, headers: { authorization: `Bearer ${token}` },
    });
    expect(response.json().hasUnappliedChanges).toBe(false);
    expect(response.json().confirmed.totalCurrent).toBe(120);
  });

  it("validates the draft query parameter strictly", async () => {
    const { server, token, id } = await setup();
    const response = await server.inject({
      method: "POST", url: `/api/projects/${id}/report?draft=maybe`, headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
  });
});
