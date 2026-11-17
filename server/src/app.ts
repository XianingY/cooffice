import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { registerSecurity } from "./middleware/security.js";
import rateLimit from "@fastify/rate-limit";
import type { Env } from "./config/env.js";
import { registerRequestLogging } from "./middleware/requestContext.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import { openDatabase, type Db } from "./db/connection.js";
import { migrate } from "./db/migrations.js";
import { UserRepository } from "./modules/auth/userRepository.js";
import { RefreshTokenRepository } from "./modules/auth/refreshTokenRepository.js";
import { AuditRepository } from "./modules/audit/auditRepository.js";
import { registerAuditRoutes } from "./modules/audit/auditRoutes.js";
import { createTokenService } from "./modules/auth/tokens.js";
import { AuthService } from "./modules/auth/authService.js";
import { RefreshTokenCleanupJob } from "./modules/auth/cleanupJob.js";
import { createLogger } from "./logging/logger.js";
import { ProfileService } from "./modules/auth/profileService.js";
import { registerProfileRoutes } from "./modules/auth/profileRoutes.js";
import { registerAuthRoutes } from "./modules/auth/authRoutes.js";
import { registerProjectRoutes } from "./modules/projects/projectRoutes.js";
import { registerProjectFileRoutes } from "./modules/projects/projectFileRoutes.js";
import { ProjectRepository } from "./modules/projects/projectRepository.js";
import { ProjectService } from "./modules/projects/projectService.js";
import { ReportService } from "./modules/reports/reportService.js";
import { registerReportRoutes } from "./modules/reports/reportRoutes.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerApiDocs } from "./docs/openapi.js";
import { EventBus } from "./events/eventBus.js";
import { registerSseRoutes } from "./events/sseRoutes.js";
import { registerStaticSpa } from "./static/spa.js";
import { registerSessionGuard } from "./middleware/sessionGuard.js";

export interface BuildAppOptions {
  env: Env;
  db?: Db;
  /**
   * Per-launch token required on `/api/*`. Only the desktop shell sets this;
   * browser deployments leave it undefined and the guard stays uninstalled.
   */
  apiToken?: string;
}

/** Assemble plugins, infrastructure and feature routes into one app instance. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;
  // Our request-context hook already logs method/status/duration with a
  // correlation ID; disable Fastify's duplicate access log to avoid noise.
  const app = Fastify({ logger: false, bodyLimit: 1_048_576, trustProxy: false });

  registerRequestLogging(app, env.LOG_LEVEL, env.NODE_ENV !== "production", env.LOG_FILE);
  registerErrorHandler(app);
  registerSessionGuard(app, options.apiToken);

  await registerSecurity(app, env);
  await app.register(cookie);
  await app.register(cors, {
    origin: env.corsOriginList,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
  });
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  const db = options.db ?? openDatabase(env.DATABASE_PATH);
  const ownsDatabase = options.db === undefined;
  migrate(db);
  const users = new UserRepository(db);
  const refreshTokens = new RefreshTokenRepository(db);
  const audit = new AuditRepository(db);
  const tokens = createTokenService(env.JWT_SECRET);
  const authService = new AuthService({
    users,
    refreshTokens,
    audit,
    tokens,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtlMs: parseTtlMs(env.JWT_REFRESH_TTL),
  });

  const projectRepo = new ProjectRepository(db);
  const projectService = new ProjectService(projectRepo, audit);
  const reportService = new ReportService(projectService);
  const eventBus = new EventBus();
  // Expose for tooling/tests; consumers should still use the SSE endpoint.
  Object.assign(app, { eventBus });

  // Swagger must initialize before routes so it can collect their schemas.
  // Embedded desktop builds skip it: no user opens an API explorer there, and
  // it is a few megabytes of static assets plus an extra exposed route.
  if (env.API_DOCS) await app.register(registerApiDocs);
  await app.register(registerHealthRoutes, { db });
  await app.register(registerAuthRoutes, { service: authService, users, tokens, env });
  await app.register(registerProfileRoutes, { service: new ProfileService(users), tokens });
  await app.register(registerProjectRoutes, { service: projectService, tokens, events: eventBus });
  await app.register(registerProjectFileRoutes, { service: projectService, tokens });
  await app.register(registerReportRoutes, { service: reportService, tokens });
  await app.register(registerSseRoutes, { bus: eventBus, tokens });
  await app.register(registerAuditRoutes, { repo: audit, tokens });

  // Background cleanup is idempotent and independent of request handling.
  const cleanupJob = new RefreshTokenCleanupJob({
    repo: refreshTokens,
    logger: createLogger(env.LOG_LEVEL, false, env.LOG_FILE),
  });
  cleanupJob.start();
  app.addHook("onClose", async () => cleanupJob.stop());

  // Desktop and single-binary deployments serve the built SPA from this
  // server; registered last so every API route wins over the SPA catch-all.
  if (env.SERVE_STATIC) {
    await registerStaticSpa(app, { root: env.STATIC_DIR });
  }

  // Only close a handle we opened; injected test databases stay caller-owned.
  if (ownsDatabase) {
    app.addHook("onClose", async () => {
      db.close();
    });
  }

  return app;
}

function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 86400_000;
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return Number(match[1]) * factor;
}
