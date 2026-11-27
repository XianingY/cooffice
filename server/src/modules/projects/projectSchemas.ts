import { z } from "zod";

const region = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  previous: z.number().finite().nonnegative(),
  current: z.number().finite().nonnegative(),
  previousCell: z.string().regex(/^B\d+$/),
  currentCell: z.string().regex(/^C\d+$/),
}).strict().refine(
  (value) => value.previousCell.slice(1) === value.currentCell.slice(1),
  { message: "Source cells must be on the same row", path: ["currentCell"] },
);

export const salesDataSchema = z.object({ regions: z.array(region).min(1).max(1000) }).strict().superRefine(
  (data, ctx) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    data.regions.forEach((item, index) => {
      if (ids.has(item.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate region id", path: ["regions", index, "id"] });
      }
      if (names.has(item.name)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate region name", path: ["regions", index, "name"] });
      }
      ids.add(item.id);
      names.add(item.name);
    });
  },
);

export const reportConfigSchema = z.object({
  blocks: z.array(z.enum(["summary", "growthNarrative", "leaderNarrative"])),
}).strict();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  baseline: salesDataSchema,
  draft: salesDataSchema.optional(),
  config: reportConfigSchema.optional(),
}).strict();

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  baseline: salesDataSchema.optional(),
  draft: salesDataSchema.optional(),
  config: reportConfigSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const draftBodySchema = z.object({ draft: salesDataSchema }).strict();

export const listProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(["updatedAt", "name"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  search: z.string().trim().max(120).optional(),
}).strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
