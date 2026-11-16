import { randomUUID } from "node:crypto";
import type { Db } from "../../db/connection.js";
import type { UserRecord } from "../types.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

const mapRow = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  displayName: row.display_name,
  role: row.role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class UserRepository {
  constructor(private readonly db: Db) {}

  findByEmail(email: string): UserRecord | null {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
    return row ? mapRow(row) : null;
  }

  findById(id: string): UserRecord | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? mapRow(row) : null;
  }

  create(input: { email: string; passwordHash: string; displayName: string; role?: "user" | "admin" }): UserRecord {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.email.toLowerCase(), input.passwordHash, input.displayName, input.role ?? "user", now, now);
    return this.findById(id)!;
  }

  updatePassword(id: string, passwordHash: string): void {
    this.db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .run(passwordHash, new Date().toISOString(), id);
  }
}
