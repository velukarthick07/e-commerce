import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateCategorySchema } from "@/validators/category.validator";
import { categoryService } from "@/services/category.service";
import { BadRequestError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

async function numericId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) throw new BadRequestError("Invalid category id");
  return parsed;
}

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("categories:read", request);
  return ok(await categoryService.getById(await numericId(ctx)), "Category loaded");
});

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("categories:update", request);
  const input = await parseBody(request, updateCategorySchema);
  return ok(
    await categoryService.update(await numericId(ctx), input),
    "Category updated successfully"
  );
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("categories:delete", request);
  return ok(await categoryService.remove(await numericId(ctx)), "Category deleted successfully");
});
