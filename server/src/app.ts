import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
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
import { ProfileService } from "./modules/auth/profileService.js";
import { registerProfileRoutes } from "./modules/auth/profileRoutes.js";
import { registerAuthRoutes } from "./modules/auth/authRoutes.js";
import { registerProjectRoutes } from "./modules/projects/projectRoutes.js";
import { ProjectRepository } from "./modules/projects/projectRepository.js";
import { ProjectService } from "./modules/projects/projectService.js";
import { ReportService } from "./modules/reports/reportService.js";
import { registerReportRoutes } from "./modules/reports/reportRoutes.js";
import { registerHealthRoutes } from "./health/routes.js";
import { registerApiDocs } from "./docs/openapi.js";
import { EventBus } from "./events/eventBus.js";
import { registerSseRoutes } from "./events/sseRoutes.js";

export interface BuildAppOptions {
  env: Env;
  db?: Db;
}

/** Assemble plugins, infrastructure and feature routes into one app instance. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;
  // Fastify v5 accepts a pino options object (not an external instance).
  // This gives every request a child logger carrying the correlation fields.
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL === "silent" ? "silent" : env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", "password", "token", "refreshToken"],
    },
    bodyLimit: 1_048_576,
    trustProxy: false,
  });

  registerRequestLogging(app);
  registerErrorHandler(app);

  await app.register(helmet, { contentSecurityPolicy: false });
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
  await app.register(registerApiDocs);
  await app.register(registerHealthRoutes, { db });
  await app.register(registerAuthRoutes, { service: authService, users, tokens, env });
  await app.register(registerProfileRoutes, { service: new ProfileService(users), tokens });
  await app.register(registerProjectRoutes, { service: projectService, tokens, events: eventBus });
  await app.register(registerReportRoutes, { service: reportService, tokens });
  await app.register(registerSseRoutes, { bus: eventBus, tokens });
  await app.register(registerAuditRoutes, { repo: audit, tokens });

  return app;
}

function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 86400_000;
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return Number(match[1]) * factor;
}
