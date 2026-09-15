import { z } from "zod";
import { optionalFilter, paginationQuery } from "./common.validator";

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  parentId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().positive().nullable()
  ),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  parentId: optionalFilter(z.coerce.number().int()),
  isActive: optionalFilter(z.enum(["true", "false"])),
  tree: optionalFilter(z.enum(["true", "false"])),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
