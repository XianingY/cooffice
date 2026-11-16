import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

/** Open a SQLite database with WAL, foreign keys and busy timeout enabled. */
export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  return db;
}

/** Execute a function in an IMMEDIATE transaction (rollback on any throw). */
export function transaction<T>(db: Db, work: () => T): T {
  return db.transaction(work).immediate();
}
