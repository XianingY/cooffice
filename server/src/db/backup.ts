import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./connection.js";

export const DEFAULT_BACKUP_KEEP = 5;

export interface BackupResult {
  filePath: string;
  bytes: number;
  removed: string[];
}

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

/**
 * Snapshot the database before a schema migration.
 *
 * Uses SQLite's online backup API rather than copying the file, so the snapshot
 * is consistent even with WAL pages still in flight. Old snapshots are pruned
 * to a small ring: a desktop user has no operator to collect them.
 */
export async function backupDatabase(
  db: Db,
  directory: string,
  options: { keep?: number; now?: Date } = {},
): Promise<BackupResult> {
  const keep = Math.max(1, options.keep ?? DEFAULT_BACKUP_KEEP);
  mkdirSync(directory, { recursive: true });

  const filePath = join(directory, `whatif-${stamp(options.now ?? new Date())}.db`);
  await db.backup(filePath);

  const snapshots = readdirSync(directory)
    .filter((name) => name.startsWith("whatif-") && name.endsWith(".db"))
    .map((name) => join(directory, name))
    // Newest first: the timestamp prefix sorts lexicographically.
    .sort()
    .reverse();

  const removed: string[] = [];
  for (const stale of snapshots.slice(keep)) {
    try {
      rmSync(stale, { force: true });
      removed.push(stale);
    } catch {
      // A locked snapshot must not block startup.
    }
  }

  let bytes = 0;
  try {
    bytes = statSync(filePath).size;
  } catch {
    // Size is informational only.
  }
  return { filePath, bytes, removed };
}
