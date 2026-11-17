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
  RATE_LIMIT_MAX: 1000, RATE_LIMIT_WINDOW: "1m", API_DOCS: true, SERVE_STATIC: false, STATIC_DIR: "../dist",
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
});
