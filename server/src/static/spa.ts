import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { SPA_CSP } from "./csp.js";

export { SPA_CSP };

export interface StaticSpaOptions {
  /** Absolute path of the built SPA (contains index.html and assets/). */
  root: string;
  /** Long-lived caching for hashed bundles; index.html always revalidates. */
  immutableAssets?: boolean;
}

/** Paths that must keep returning the JSON error contract, never the SPA. */
const API_PREFIXES = ["/api/", "/health", "/ready", "/docs"];

function isApiRequest(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return API_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

function applyHeaders(reply: FastifyReply, filePath: string, immutableAssets: boolean): void {
  reply.header("Content-Security-Policy", SPA_CSP);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  const normalised = filePath.split("\\").join("/");
  if (immutableAssets && normalised.includes("/assets/")) {
    // Vite content-hashes everything under assets/, so the URL is the version.
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    reply.header("Cache-Control", "no-cache");
  }
}/**
 * Serve the built SPA from the API server itself.
 *
 * Desktop builds need this: the renderer is loaded from the embedded server so
 * that cookies, SSE and fetch share one origin (no CORS, no file:// carve-outs).
 * Registered last so that every API route wins over the SPA catch-all.
 */
export async function registerStaticSpa(app: FastifyInstance, options: StaticSpaOptions): Promise<void> {
  const root = resolve(options.root);
  const indexPath = join(root, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`Static SPA directory is missing index.html: ${root}`);
  }
  const immutableAssets = options.immutableAssets ?? true;

  await app.register(fastifyStatic, {
    root,
    // Files are registered as exact routes; the catch-all below handles deep
    // links so client-side routes never 404 on reload.
    wildcard: false,
    index: ["index.html"],
    cacheControl: false,
    etag: true,
    lastModified: true,
    // @fastify/static hands us the Fastify reply, so header helpers apply.
    setHeaders: (reply, filePath) => {
      applyHeaders(reply as unknown as FastifyReply, filePath, immutableAssets);
    },
  });

  const sendIndex = async (request: FastifyRequest, reply: FastifyReply) => {
    applyHeaders(reply, indexPath, immutableAssets);
    return reply.sendFile("index.html", root);
  };

  // Deep links (e.g. /projects/42) resolve to the SPA shell.
  app.get("/*", async (request, reply) => {
    if (isApiRequest(request.url)) return reply.callNotFound();
    return sendIndex(request, reply);
  });
}
