import { randomUUID } from "node:crypto";
import { AppError } from "../../errors/AppError.js";
import { AuditRepository } from "../audit/auditRepository.js";
import type { PublicUser, UserRecord } from "../types.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  generateRefreshToken,
  hashToken,
  RefreshTokenRepository,
} from "./refreshTokenRepository.js";
import { createTokenService, type TokenService } from "./tokens.js";
import { UserRepository } from "./userRepository.js";

export interface AuthDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  audit: AuditRepository;
  tokens: TokenService;
  accessTtl: string;
  refreshTtlMs: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const value = Number(match[1]);
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as "s" | "m" | "h" | "d"];
  return value * factor;
}

/** Business logic for authentication; no Fastify request/reply types here. */
export class AuthService {
  constructor(private readonly deps: AuthDeps) {}

  async register(input: { email: string; password: string; displayName: string }, requestId: string): Promise<TokenPair> {
    const email = input.email.trim().toLowerCase();
    if (this.deps.users.findByEmail(email)) throw AppError.conflict("An account with this email already exists");
    const passwordHash = await hashPassword(input.password);
    const user = this.deps.users.create({ email, passwordHash, displayName: input.displayName.trim() });
    this.deps.audit.append({ requestId, actorId: user.id, action: "register", entity: "auth", entityId: user.id });
    return this.issuePair(user, requestId);
  }

  async login(input: { email: string; password: string }, requestId: string): Promise<TokenPair> {
    const user = this.deps.users.findByEmail(input.email.trim().toLowerCase());
    // Run a dummy verification to avoid user-enumeration timing differences.
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw AppError.unauthorized("Invalid email or password");
    this.deps.audit.append({ requestId, actorId: user.id, action: "login", entity: "auth", entityId: user.id });
    return this.issuePair(user, requestId);
  }

  async refresh(rawToken: string, requestId: string): Promise<TokenPair> {
    const record = this.deps.refreshTokens.findByHash(hashToken(rawToken));
    if (!record || record.expiresAt <= Date.now()) {
      throw AppError.unauthorized("Refresh token is invalid or expired");
    }
    if (record.revokedAt !== null) {
      // A rotated token cannot come back legitimately. Assume theft and drop
      // every active session for the account, not just this family: the
      // attacker may already hold a newer family from an earlier replay.
      this.deps.refreshTokens.revokeAllForUser(record.userId);
      this.deps.audit.append({
        requestId,
        actorId: record.userId,
        action: "token_reuse_detected",
        entity: "auth",
        entityId: record.userId,
      });
      throw AppError.unauthorized("Refresh token is invalid or expired");
    }
    const user = this.deps.users.findById(record.userId);
    if (!user) throw AppError.unauthorized("Account no longer exists");

    // Revoke the old family entirely; a new token starts a fresh family so
    // reuse of this token later can be detected without punishing this session.
    this.deps.refreshTokens.revokeFamily(record.familyId);
    this.deps.audit.append({ requestId, actorId: user.id, action: "token_refresh", entity: "auth", entityId: user.id });
    return this.issuePair(user, requestId);
  }

  logout(rawToken: string, requestId: string): void {
    const record = this.deps.refreshTokens.findByHash(hashToken(rawToken));
    if (record && record.revokedAt === null) {
      this.deps.refreshTokens.revokeFamily(record.familyId);
      this.deps.audit.append({ requestId, actorId: record.userId, action: "logout", entity: "auth", entityId: record.userId });
    }
  }

  private async issuePair(user: UserRecord, requestId: string, familyId: string = randomUUID()): Promise<TokenPair> {
    const accessToken = await this.deps.tokens.signAccess(
      { sub: user.id, email: user.email, role: user.role },
      this.deps.accessTtl,
    );
    const refreshToken = generateRefreshToken();
    this.deps.refreshTokens.create(user.id, hashToken(refreshToken), familyId, Date.now() + this.deps.refreshTtlMs);
    this.deps.audit.append({ requestId, actorId: user.id, action: "tokens_issued", entity: "auth", entityId: user.id });
    return {
      accessToken,
      refreshToken,
      expiresIn: ttlToSeconds(this.deps.accessTtl),
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt },
    };
  }
}

// Precomputed hash of a throwaway password to keep failed logins timing-stable.
const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);
