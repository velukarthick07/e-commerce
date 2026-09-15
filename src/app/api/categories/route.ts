import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import {
  createCategorySchema,
  listCategoriesQuery,
} from "@/validators/category.validator";
import { categoryService } from "@/services/category.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("categories:read", request);
  const query = parseQuery(request, listCategoriesQuery);

  if (query.tree === "true") {
    const tree = await categoryService.tree(query.isActive === "true");
    return ok(tree, "Categories loaded");
  }

  const { items, meta } = await categoryService.list({
    ...query,
    isActive: query.isActive === undefined ? undefined : query.isActive === "true",
  });
  return ok(items, "Categories loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  await requirePermission("categories:create", request);
  const input = await parseBody(request, createCategorySchema);
  return created(await categoryService.create(input), "Category created successfully");
});
