import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const positiveInt = z.coerce.number().int().positive();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: positiveInt.default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Append JSON logs to this file instead of stdout (desktop packaging). */
  LOG_FILE: z.string().optional(),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, "JWT_ACCESS_TTL must look like 15m").default("15m"),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, "JWT_REFRESH_TTL must look like 7d").default("7d"),
  COOKIE_SECURE: booleanFromString.default("false"),
  COOKIE_DOMAIN: z.string().optional(),

  DATABASE_PATH: z.string().min(1).default("./data/whatif.db"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_MAX: positiveInt.default(100),
  RATE_LIMIT_WINDOW: z.string().default("1m"),

  /** OpenAPI/Swagger UI; development and API deployments only. */
  API_DOCS: booleanFromString.default("true"),
  SERVE_STATIC: booleanFromString.default("false"),
  STATIC_DIR: z.string().default("../dist"),
});

export type Env = z.infer<typeof schema> & { corsOriginList: string[] };

/**
 * Validate configuration once at startup and fail fast. Never log secret
 * values; only their presence is reported through the returned shape.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
  }
  const corsOriginList = parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (parsed.data.NODE_ENV === "production" && corsOriginList.includes("*")) {
    throw new Error("CORS_ORIGINS cannot contain '*' in production");
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.JWT_SECRET.startsWith("dev-only")) {
    throw new Error("JWT_SECRET must be changed from the development placeholder in production");
  }
  // An empty string means "log to stdout"; keep the type narrow for consumers.
  const logFile = parsed.data.LOG_FILE && parsed.data.LOG_FILE.length > 0 ? parsed.data.LOG_FILE : undefined;
  return { ...parsed.data, LOG_FILE: logFile, corsOriginList };
}
