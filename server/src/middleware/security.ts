import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import type { Env } from "../config/env.js";

/** Environment-aware security headers for the JSON API and docs UI. */
export async function registerSecurity(app: FastifyInstance, env: Env): Promise<void> {
  await app.register(helmet, {
    // The SPA is served by nginx with its own CSP; the API returns JSON only.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    hsts: env.NODE_ENV === "production"
      ? { maxAge: 31_536_000, includeSubDomains: true }
      : false,
  });
}
