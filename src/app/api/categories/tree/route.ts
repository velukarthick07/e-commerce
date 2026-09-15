import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { categoryService } from "@/services/category.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("categories:read", request);
  const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";
  return ok(await categoryService.tree(activeOnly), "Category tree loaded");
});
