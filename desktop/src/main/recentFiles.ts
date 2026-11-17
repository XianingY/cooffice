import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Most-recently-opened project files, newest first.
 *
 * Only paths are stored: the project content stays on disk where the user put
 * it, and a stale entry is dropped the moment the file cannot be read.
 */
export class RecentFilesStore {
  private readonly limit: number;

  constructor(
    private readonly file: string,
    limit = 8,
  ) {
    this.limit = Math.max(1, limit);
  }

  list(): string[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        .filter((entry) => existsSync(entry))
        .slice(0, this.limit);
    } catch {
      return [];
    }
  }

  add(filePath: string): string[] {
    const next = [filePath, ...this.list().filter((entry) => entry !== filePath)].slice(0, this.limit);
    this.persist(next);
    return next;
  }

  remove(filePath: string): string[] {
    const next = this.list().filter((entry) => entry !== filePath);
    this.persist(next);
    return next;
  }

  clear(): void {
    this.persist([]);
  }

  private persist(entries: string[]): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(entries, null, 2), "utf8");
    } catch {
      // A read-only profile directory should not break opening files.
    }
  }
}
