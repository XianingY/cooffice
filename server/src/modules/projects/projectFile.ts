import { z } from "zod";
import { AppError } from "../../errors/AppError.js";
import type { ProjectRecord, ReportConfig, SalesData } from "../types.js";

const regionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  previous: z.number().finite().nonnegative(),
  current: z.number().finite().nonnegative(),
  previousCell: z.string().regex(/^B\d+$/),
  currentCell: z.string().regex(/^C\d+$/),
}).strict();

const salesSchema = z.object({ regions: z.array(regionSchema).min(1).max(1000) }).strict();
const configSchema = z.object({
  blocks: z.array(z.enum(["summary", "growthNarrative", "leaderNarrative"])),
}).strict();

const documentSchema = z.object({
  format: z.literal("what-if-report-project"),
  version: z.literal(1),
  name: z.string().min(1).max(120),
  baseline: salesSchema,
  draft: salesSchema,
  config: configSchema,
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
