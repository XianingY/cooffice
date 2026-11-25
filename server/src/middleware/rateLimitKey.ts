import type { FastifyRequest } from "fastify";

/**
 * Rate-limit bucket key for deployments behind a trusted reverse proxy.
 *
 * We deliberately do NOT enable Fastify's `trustProxy`, because the leftmost
 * `X-Forwarded-For` entry is supplied by the client and is trivially forged.
 * Our nginx config unconditionally overwrites `X-Real-IP` with `$remote_addr`,
 * so that single value is safe to use — but only when the operator has opted
 * in via TRUST_PROXY. Direct exposures keep keying on the socket address.
 */
export function makeRateLimitKey(trustProxy: boolean) {
  return (request: FastifyRequest): string => {
    if (trustProxy) {
      const realIp = request.headers["x-real-ip"];
      if (typeof realIp === "string" && realIp.length > 0) return realIp;
    }
    return request.ip;
  };
}
