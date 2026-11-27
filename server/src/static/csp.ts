/**
 * Content-Security-Policy used when the SPA is served by this server (desktop
 * shell and self-hosted single-binary deployments). The nginx deployment keeps
 * its own policy, so this never weakens the Docker path.
 *
 * Kept dependency-free so `tests/config/nginxCsp.test.ts` can verify parity
 * without pulling Fastify types into the web-only typecheck.
 */
export const SPA_CSP = [
  "default-src 'self'",
  // Vite emits external modules only; no inline scripts are needed.
  "script-src 'self'",
  // React sets a few inline style attributes (progress widths, chart geometry).
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // API calls and SSE are same-origin by construction.
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");
