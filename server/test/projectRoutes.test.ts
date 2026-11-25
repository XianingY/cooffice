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
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", TRUST_PROXY: false, API_DOCS: true, SERVE_STATIC: false, STATIC_DIR: "../dist",
  corsOriginList: ["http://localhost:5173"],
};

const data = { regions: [{ id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" }] };

let app: FastifyInstance | undefined;
let db: Db | undefined;
afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

async function setup() {
  db = openDatabase(":memory:");
  app = await buildApp({ env, db });
  await app.ready();
  const registered = await app.inject({
    method: "POST", url: "/api/auth/register",
    payload: { email: "api@test.dev", password: "password123", displayName: "API" },
  });
  return { server: app, token: registered.json().accessToken as string };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("project routes", () => {
  it("requires authentication for all project endpoints", async () => {
    const { server } = await setup();
    expect((await server.inject({ method: "GET", url: "/api/projects" })).statusCode).toBe(401);
  });

  it("creates, lists, reads, updates and deletes a project", async () => {
    const { server, token } = await setup();
    const created = await server.inject({
      method: "POST", url: "/api/projects", headers: auth(token),
      payload: { name: "My Project", baseline: data },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const list = await server.inject({ method: "GET", url: "/api/projects", headers: auth(token) });
    expect(list.json().items).toHaveLength(1);
    expect(list.json().total).toBe(1);

    const one = await server.inject({ method: "GET", url: `/api/projects/${id}`, headers: auth(token) });
    expect(one.json().name).toBe("My Project");

    const patched = await server.inject({
      method: "PATCH", url: `/api/projects/${id}`, headers: auth(token), payload: { name: "Renamed" },
    });
    expect(patched.json().name).toBe("Renamed");
    expect(patched.json().version).toBe(2);

    const deleted = await server.inject({ method: "DELETE", url: `/api/projects/${id}`, headers: auth(token) });
    expect(deleted.statusCode).toBe(204);
    expect((await server.inject({ method: "GET", url: `/api/projects/${id}`, headers: auth(token) })).statusCode).toBe(404);
  });

  it("supports draft edit, apply and revert through HTTP", async () => {
    const { server, token } = await setup();
    const created = await server.inject({
      method: "POST", url: "/api/projects", headers: auth(token), payload: { name: "P", baseline: data },
    });
    const id = created.json().id as string;
    const edited = structuredClone(data);
    edited.regions[0].current = 90;

    const draftRes = await server.inject({
      method: "PUT", url: `/api/projects/${id}/draft`, headers: auth(token), payload: { draft: edited },
    });
    expect(draftRes.json().draft.regions[0].current).toBe(90);
    expect(draftRes.json().baseline.regions[0].current).toBe(120);

    const applied = await server.inject({ method: "POST", url: `/api/projects/${id}/apply`, headers: auth(token) });
    expect(applied.json().baseline.regions[0].current).toBe(90);

    const reverted = await server.inject({ method: "POST", url: `/api/projects/${id}/revert`, headers: auth(token) });
    expect(reverted.json().draft.regions[0].current).toBe(90);
  });

  it("enforces ownership across users", async () => {
    const { server, token } = await setup();
    const created = await server.inject({
      method: "POST", url: "/api/projects", headers: auth(token), payload: { name: "P", baseline: data },
    });
    const id = created.json().id as string;
    const other = await server.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "other@test.dev", password: "password123", displayName: "Other" },
    });
    const response = await server.inject({
      method: "GET", url: `/api/projects/${id}`, headers: auth(other.json().accessToken),
    });
    expect(response.statusCode).toBe(403);
  });
});
