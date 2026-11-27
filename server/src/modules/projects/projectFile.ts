import { z } from "zod";
import { AppError } from "../../errors/AppError.js";
import type { ProjectRecord, ReportConfig, SalesData } from "../types.js";
import { reportConfigSchema, salesDataSchema } from "./projectSchemas.js";

const documentSchema = z.object({
  format: z.literal("what-if-report-project"),
  version: z.literal(1),
  name: z.string().min(1).max(120),
  baseline: salesDataSchema,
  draft: salesDataSchema,
  config: reportConfigSchema,
}).strict();

export interface ProjectDocument {
  format: "what-if-report-project";
  version: 1;
  name: string;
  baseline: SalesData;
  draft: SalesData;
  config: ReportConfig;
}

/** Build a portable document from a stored project (no owner data leaked). */
export function toProjectDocument(project: ProjectRecord): ProjectDocument {
  return {
    format: "what-if-report-project",
    version: 1,
    name: project.name,
    baseline: project.baseline,
    draft: project.draft,
    config: project.config,
  };
}

/** Validate an untrusted import document; never trust posted data. */
export function parseProjectDocument(value: unknown): ProjectDocument {
  const result = documentSchema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest(
      "Project document is invalid",
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return result.data;
}
