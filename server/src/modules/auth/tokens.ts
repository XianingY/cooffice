import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "../types.js";

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  email: string;
  role: Role;
  type: "access";
}

export interface TokenService {
  signAccess(payload: { sub: string; email: string; role: Role }, ttl: string): Promise<string>;
  verifyAccess(token: string): Promise<AccessTokenClaims>;
}

// Copy into the current realm: jose's webapi build rejects Uint8Array
// instances created in a different realm (e.g. jsdom test environments).
function secretKey(secret: string): Uint8Array {
  return Uint8Array.from(new TextEncoder().encode(secret));
}

/** HS256 access tokens signed with the validated startup secret. */
export function createTokenService(secret: string, issuer = "what-if-report"): TokenService {
  const key = secretKey(secret);
  return {
    async signAccess(payload, ttl) {
      return new SignJWT({ email: payload.email, role: payload.role, type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.sub)
        .setIssuer(issuer)
        .setIssuedAt()
        .setExpirationTime(ttl)
        .sign(key);
    },
    async verifyAccess(token) {
      const { payload } = await jwtVerify(token, key, { issuer, algorithms: ["HS256"] });
      if (payload.type !== "access" || typeof payload.sub !== "string") {
        throw new Error("Invalid token claims");
      }
      return payload as AccessTokenClaims;
    },
  };
}
