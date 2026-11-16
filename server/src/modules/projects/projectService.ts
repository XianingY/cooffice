import { AppError } from "../../errors/AppError.js";
import { AuditRepository } from "../audit/auditRepository.js";
import type { ReportConfig, SalesData } from "../types.js";
import { ProjectRepository, type ProjectListOptions } from "./projectRepository.js";
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from "./projectSchemas.js";

const DEFAULT_CONFIG: ReportConfig = { blocks: ["summary", "growthNarrative", "leaderNarrative"] };

/** Business rules for projects. No HTTP types; returns domain records. */
export class ProjectService {
  constructor(private readonly repo: ProjectRepository, private readonly audit: AuditRepository) {}

  create(ownerId: string, input: CreateProjectInput, requestId: string) {
    const project = this.repo.create({
      ownerId,
      name: input.name,
      baseline: input.baseline,
      draft: input.draft ?? input.baseline,
      config: input.config ?? DEFAULT_CONFIG,
    });
    this.audit.append({ requestId, actorId: ownerId, action: "project.create", entity: "project", entityId: project.id });
    return project;
  }

  list(ownerId: string, query: ListProjectsQuery) {
    const options: ProjectListOptions = {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      sort: query.sort ?? "updatedAt",
      order: query.order ?? "desc",
      search: query.search,
    };
    return {
      items: this.repo.listByOwner(ownerId, options),
      total: this.repo.countByOwner(ownerId, query.search),
      limit: options.limit,
      offset: options.offset,
    };
  }

  get(ownerId: string, id: string) {
    const project = this.repo.findById(id);
    if (!project) throw AppError.notFound("Project not found");
    if (project.ownerId !== ownerId) throw AppError.forbidden("This project belongs to another user");
    return project;
  }

  update(ownerId: string, id: string, input: UpdateProjectInput, requestId: string) {
    const existing = this.get(ownerId, id);
    const updated = this.repo.update(id, input, input.expectedVersion ?? existing.version);
    if (!updated) throw AppError.conflict("Project was modified by another request; retry with fresh data");
    this.audit.append({
      requestId,
      actorId: ownerId,
      action: "project.update",
      entity: "project",
      entityId: id,
      metadata: { version: updated.version },
    });
    return updated;
  }

  remove(ownerId: string, id: string, requestId: string) {
    this.get(ownerId, id);
    this.repo.delete(id);
    this.audit.append({ requestId, actorId: ownerId, action: "project.delete", entity: "project", entityId: id });
  }

  /** Update only the draft; baseline (confirmed) data is never touched. */
  editDraft(ownerId: string, id: string, draft: SalesData, requestId: string) {
    return this.update(ownerId, id, { draft }, requestId);
  }

  /** Apply the draft as the new confirmed baseline. */
  applyDraft(ownerId: string, id: string, requestId: string) {
    const project = this.get(ownerId, id);
    return this.update(ownerId, id, { baseline: project.draft }, requestId);
  }

  /** Discard draft changes by restoring the confirmed baseline. */
  revertDraft(ownerId: string, id: string, requestId: string) {
    const project = this.get(ownerId, id);
    return this.update(ownerId, id, { draft: project.baseline }, requestId);
  }
}
