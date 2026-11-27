import { randomUUID } from "node:crypto";
import type { Db } from "../../db/connection.js";
import type { ProjectRecord, ProjectSummaryRecord, ReportConfig, SalesData } from "../types.js";

interface ProjectSummaryRow {
  id: string;
  owner_id: string;
  name: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface ProjectRow extends ProjectSummaryRow {
  baseline_json: string;
  draft_json: string;
  config_json: string;
}

const mapSummaryRow = (row: ProjectSummaryRow): ProjectSummaryRecord => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRow = (row: ProjectRow): ProjectRecord => ({
  ...mapSummaryRow(row),
  baseline: JSON.parse(row.baseline_json) as SalesData,
  draft: JSON.parse(row.draft_json) as SalesData,
  config: JSON.parse(row.config_json) as ReportConfig,
});

/** Escape SQL LIKE wildcards so literal `%`, `_` and `\` search predictably. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export interface ProjectListOptions {
  limit?: number;
  offset?: number;
  sort?: "updatedAt" | "name";
  order?: "asc" | "desc";
  search?: string;
}

export class ProjectRepository {
  constructor(private readonly db: Db) {}

  findById(id: string): ProjectRecord | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    return row ? mapRow(row) : null;
  }

  listByOwner(ownerId: string, options: ProjectListOptions = {}): ProjectSummaryRecord[] {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const column = options.sort === "name" ? "name" : "updated_at";
    const direction = options.order === "asc" ? "ASC" : "DESC";
    const search = options.search?.trim();
    const where = search ? "owner_id = ? AND name LIKE ? ESCAPE '\\'" : "owner_id = ?";
    const params = search ? [ownerId, `%${escapeLike(search)}%`, limit, offset] : [ownerId, limit, offset];
    const rows = this.db
      .prepare(
        `SELECT id, owner_id, name, version, created_at, updated_at
         FROM projects WHERE ${where} ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`,
      )
      .all(...params) as ProjectSummaryRow[];
    return rows.map(mapSummaryRow);
  }

  countByOwner(ownerId: string, search?: string): number {
    const term = search?.trim();
    const row = term
      ? this.db
          .prepare("SELECT COUNT(*) AS n FROM projects WHERE owner_id = ? AND name LIKE ? ESCAPE '\\'")
          .get(ownerId, `%${escapeLike(term)}%`)
      : this.db.prepare("SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?").get(ownerId);
    return (row as { n: number }).n;
  }

  create(input: Omit<ProjectRecord, "id" | "version" | "createdAt" | "updatedAt">): ProjectRecord {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO projects (id, owner_id, name, baseline_json, draft_json, config_json, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      input.ownerId,
      input.name,
      JSON.stringify(input.baseline),
      JSON.stringify(input.draft),
      JSON.stringify(input.config),
      now,
      now,
    );
    return this.findById(id)!;
  }

  update(
    id: string,
    patch: Partial<Pick<ProjectRecord, "name" | "baseline" | "draft" | "config">>,
    expectedVersion?: number,
  ): ProjectRecord | null {
    const current = this.findById(id);
    if (!current) return null;
    if (expectedVersion !== undefined && current.version !== expectedVersion) return null;

    const next = {
      name: patch.name ?? current.name,
      baseline: patch.baseline ?? current.baseline,
      draft: patch.draft ?? current.draft,
      config: patch.config ?? current.config,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    // Conditional on the version we read: two concurrent writers both reading
    // v1 cannot both produce v2, because the second WHERE no longer matches.
    const changes = this.db.prepare(
      `UPDATE projects SET name = ?, baseline_json = ?, draft_json = ?, config_json = ?, version = ?, updated_at = ?
       WHERE id = ? AND version = ?`,
    ).run(
      next.name,
      JSON.stringify(next.baseline),
      JSON.stringify(next.draft),
      JSON.stringify(next.config),
      next.version,
      next.updatedAt,
      id,
      current.version,
    ).changes;
    if (changes === 0) return null;
    return this.findById(id)!;
  }

  delete(id: string): boolean {
    return this.db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  }
}
