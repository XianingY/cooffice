import type { Db } from "../../db/connection.js";

export interface AuditEntry {
  requestId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRecord extends AuditEntry {
  id: number;
  createdAt: string;
}

/** Append-only audit log for security-relevant actions. */
export class AuditRepository {
  constructor(private readonly db: Db) {}

  append(entry: AuditEntry): void {
    this.db.prepare(
      `INSERT INTO audit_logs (request_id, actor_id, action, entity, entity_id, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entry.requestId,
      entry.actorId,
      entry.action,
      entry.entity,
      entry.entityId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      new Date().toISOString(),
    );
  }

  list(entity: string, entityId?: string, limit = 50): AuditRecord[] {
    const rows = entityId
      ? this.db.prepare("SELECT * FROM audit_logs WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?")
          .all(entity, entityId, limit)
      : this.db.prepare("SELECT * FROM audit_logs WHERE entity = ? ORDER BY id DESC LIMIT ?").all(entity, limit);
    return (rows as {
      id: number; request_id: string; actor_id: string | null; action: string; entity: string;
      entity_id: string | null; metadata_json: string | null; created_at: string;
    }[]).map((row) => ({
      id: row.id,
      requestId: row.request_id,
      actorId: row.actor_id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id ?? undefined,
      metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
      createdAt: row.created_at,
    }));
  }
}
