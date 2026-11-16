import type { FastifyInstance } from "fastify";
import type { Db } from "../db/connection.js";

export interface HealthOptions {
  db: Db;
}

/** Liveness and readiness endpoints for orchestrators and smoke tests. */
export async function registerHealthRoutes(app: FastifyInstance, options: HealthOptions): Promise<void> {
  app.get("/health", async () => ({ status: "ok", uptimeSeconds: Math.round(process.uptime()) }));

  app.get("/ready", async (_request, reply) => {
    try {
      const row = options.db.prepare("SELECT 1 AS ok").get() as { ok: number };
      if (row.ok !== 1) throw new Error("unexpected probe result");
      return { status: "ready", database: "ok" };
    } catch {
      void reply.status(503).send({ status: "unavailable", database: "error" });
    }
  });
}
