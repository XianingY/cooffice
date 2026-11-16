import type { Db } from "./connection.js";

export interface Migration {
  id: number;
  name: string;
  up: string;
}

/** Ordered, append-only migrations. Never edit an applied migration. */
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "create_users",
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
  },
  {
    id: 2,
    name: "create_projects",
    up: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        baseline_json TEXT NOT NULL,
        draft_json TEXT NOT NULL,
        config_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON projects(owner_id, updated_at DESC);
    `,
  },
  {
    id: 3,
    name: "create_refresh_tokens",
    up: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        family_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id);
    `,
  },
  {
    id: 4,
    name: "create_audit_logs",
    up: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        actor_id TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
    `,
  },
  {
    id: 5,
    name: "optimize_list_queries",
    up: `
      -- Covering index for owner-scoped listing with sorting and pagination.
      CREATE INDEX IF NOT EXISTS idx_projects_owner_updated_cover
        ON projects(owner_id, updated_at DESC, id, name, version);
      -- Audit lookups by entity and entity id.
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id, id DESC);
      -- Refresh cleanup scans expired tokens by timestamp.
      CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);
    `,
  },
];

/** Apply pending migrations inside a single transaction; record applied ids. */
export function migrate(db: Db): number[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    (db.prepare("SELECT id FROM schema_migrations").all() as { id: number }[]).map((row) => row.id),
  );
  const pending = MIGRATIONS.filter((migration) => !applied.has(migration.id));
  const run = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.up);
      db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)").run(
        migration.id,
        migration.name,
        new Date().toISOString(),
      );
    }
  });
  run.immediate();
  return pending.map((migration) => migration.id);
}
