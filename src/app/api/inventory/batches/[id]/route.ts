import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateBatchSchema } from "@/validators/inventory.validator";
import { inventoryService } from "@/services/inventory.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("inventory:read", request);
  const { id } = await ctx.params;
  return ok(await inventoryService.getBatch(id), "Batch loaded");
});

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("inventory:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, updateBatchSchema);
  return ok(await inventoryService.updateBatch(id, input, session), "Batch updated");
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("inventory:delete", request);
  const { id } = await ctx.params;
  return ok(await inventoryService.removeBatch(id, session), "Batch removed");
});
