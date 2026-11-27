import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import type { Env } from "../src/config/env.js";
import { EventBus, type DomainEvent } from "../src/events/eventBus.js";

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
afterEach(async () => { await app?.close(); db?.close(); app = undefined; db = undefined; });

describe("SSE integration", () => {
  it("publishes project events through the shared bus on mutations", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.ready();
    const auth = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "sse@test.dev", password: "password123", displayName: "SSE" },
    });
    const token = auth.json().accessToken as string;
    const headers = { authorization: `Bearer ${token}` };

    const created = await app.inject({ method: "POST", url: "/api/projects", headers, payload: { name: "P", baseline: data } });
    const id = created.json().id as string;

    // Access the bus through the app's decorated instance (exposed for tests).
    const bus = (app as FastifyInstance & { eventBus?: EventBus }).eventBus;
    expect(bus).toBeDefined();
    const received: DomainEvent[] = [];
    const unsubscribe = bus!.subscribe(id, (e: DomainEvent) => received.push(e));

    await app.inject({ method: "PATCH", url: `/api/projects/${id}`, headers, payload: { name: "P2" } });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("project.updated");
    unsubscribe();
  });

  it("refuses to stream a project owned by another user", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.ready();

    const register = async (email: string) => {
      const response = await app!.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "password123", displayName: "SSE" },
      });
      return response.json().accessToken as string;
    };
    const ownerToken = await register("owner@test.dev");
    const intruderToken = await register("intruder@test.dev");

    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: "Private", baseline: data },
    });
    const id = created.json().id as string;

    const bus = (app as FastifyInstance & { eventBus?: EventBus }).eventBus;
    const received: DomainEvent[] = [];
    const unsubscribe = bus!.subscribe(id, (e) => received.push(e));

    const forbidden = await app.inject({
      method: "GET",
      url: `/api/projects/${id}/events`,
      headers: { authorization: `Bearer ${intruderToken}`, accept: "text/event-stream" },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.message).toMatch(/another user/i);

    await app.inject({
      method: "PATCH",
      url: `/api/projects/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: "Still private" },
    });
    // The intruder never obtained a subscription; only the direct bus probe sees it.
    expect(received).toHaveLength(1);
    unsubscribe();
  });

  it("closes active SSE streams on server close and caps per-user concurrent connections", async () => {
    db = openDatabase(":memory:");
    app = await buildApp({ env, db });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("unexpected address");
    const base = `http://127.0.0.1:${address.port}`;

    const reg = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cap@test.dev", password: "password123", displayName: "Cap" }),
    });
    const { accessToken } = (await reg.json()) as { accessToken: string };
    const created = await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: "Streamed", baseline: data }),
    });
    const { id } = (await created.json()) as { id: string };

    const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
    try {
      for (let i = 0; i < 10; i += 1) {
        const res = await fetch(`${base}/api/projects/${id}/events`, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        expect(res.status).toBe(200);
        readers.push(res.body!.getReader());
      }

      const overflow = await fetch(`${base}/api/projects/${id}/events`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(overflow.status).toBe(429);

      // Closing the app must terminate active streams rather than hanging.
      const reader = readers[0];
      await app.close();
      app = undefined;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
      }
    } finally {
      await Promise.allSettled(readers.map((reader) => reader.cancel()));
    }
  });
});
