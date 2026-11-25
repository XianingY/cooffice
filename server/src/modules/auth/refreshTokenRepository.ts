import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db } from "../../db/connection.js";

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: number;
  revokedAt: number | null;
  createdAt: string;
}

interface RefreshRow {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: number;
  revoked_at: number | null;
  created_at: string;
}

const mapRow = (row: RefreshRow): RefreshTokenRecord => ({
  id: row.id,
  userId: row.user_id,
  tokenHash: row.token_hash,
  familyId: row.family_id,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  createdAt: row.created_at,
});

/** Hash raw tokens before storage so a database leak cannot replay sessions. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export class RefreshTokenRepository {
  constructor(private readonly db: Db) {}

  findByHash(hash: string): RefreshTokenRecord | null {
    const row = this.db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?").get(hash) as RefreshRow | undefined;
    return row ? mapRow(row) : null;
  }

  create(userId: string, tokenHash: string, familyId: string, expiresAt: number): RefreshTokenRecord {
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, revoked_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    ).run(id, userId, tokenHash, familyId, expiresAt, new Date().toISOString());
    return this.findByHash(tokenHash)!;
  }

  revoke(id: string, at = Date.now()): void {
    this.db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(at, id);
  }

  revokeFamily(familyId: string, at = Date.now()): void {
    this.db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL").run(at, familyId);
  }

  /**
   * Revoke every active token for a user. Used when a reused token signals
   * theft and when the password changes: in both cases the attacker may hold a
   * different family, so revoking only the presented one is not enough.
   */
  revokeAllForUser(userId: string, at = Date.now()): number {
    return this.db
      .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
      .run(at, userId).changes;
  }

  deleteExpired(now = Date.now()): number {
    return this.db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(now).changes;
  }
}
