import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import { findFreePort } from "./net.js";
import { loadOrCreateSecret } from "./secret.js";

export interface EmbeddedServerOptions {
  /** Per-user data directory (Electron `app.getPath('userData')`). */
  dataDir: string;
  /** Absolute path of the built SPA served at `/`. */
  staticDir: string;
  host?: string;
  /** Preferred port; omit or pass 0 to reserve a free loopback port. */
  port?: number;
  logLevel?: string;
  /** Persist structured logs here so packaged apps can be diagnosed. */
  logFile?: string | null;
}

export interface EmbeddedServer {
  /** Origin the renderer should load, e.g. `http://127.0.0.1:53211`. */
  origin: string;
  host: string;
  port: number;
  databasePath: string;
  /** True when this launch generated the installation secret. */
  secretCreated: boolean;
  app: FastifyInstance;
  close(): Promise<void>;
}

/**
 * Boot the API inside a desktop process.
 *
 * Differences from the container deployment are deliberate and narrow:
 * loopback-only binding, caller-chosen data directory, generated signing
 * secret, no HSTS (plain http loopback), and the SPA served from the same
 * origin so that cookies and SSE need no CORS exceptions.
 */
export async function startEmbeddedServer(options: EmbeddedServerOptions): Promise<EmbeddedServer> {
  const host = options.host ?? "127.0.0.1";
  const dataDir = resolve(options.dataDir);
  const staticDir = resolve(options.staticDir);
  mkdirSync(dataDir, { recursive: true });

  const databasePath = join(dataDir, "whatif.db");
  const { secret, created } = loadOrCreateSecret(join(dataDir, "jwt-secret.key"));

  const desiredPort = options.port && options.port > 0 ? options.port : await findFreePort(host);

  const buildEnv = (port: number) =>
    loadEnv({
      ...process.env,
      NODE_ENV: "production",
      HOST: host,
      PORT: String(port),
      LOG_LEVEL: options.logLevel ?? "info",
      LOG_FILE: options.logFile ?? "",
      JWT_SECRET: secret,
      DATABASE_PATH: databasePath,
      // Same-origin in practice; listed so that a developer preview server is
      // still accepted when it runs on the default Vite port.
      CORS_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}`,
      COOKIE_SECURE: "false",
      RATE_LIMIT_MAX: "600",
      RATE_LIMIT_WINDOW: "1m",
      API_DOCS: "false",
      SERVE_STATIC: "true",
      STATIC_DIR: staticDir,
    });

  // A port can be taken between the probe and the bind; retry with a fresh one.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const port = attempt === 0 ? desiredPort : await findFreePort(host);
    const app = await buildApp({ env: buildEnv(port) });
    try {
      await app.listen({ host, port });
      return {
        origin: `http://${host}:${port}`,
        host,
        port,
        databasePath,
        secretCreated: created,
        app,
        close: async () => {
          await app.close();
        },
      };
    } catch (error) {
      await app.close().catch(() => undefined);
      lastError = error;
      if (attempt === 2) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to start the embedded API server");
}
