import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateCustomerSchema } from "@/validators/customer.validator";
import { customerService } from "@/services/customer.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("customers:read", request);
  const { id } = await ctx.params;
  return ok(await customerService.getById(id), "Customer loaded");
});

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("customers:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, updateCustomerSchema);
  return ok(await customerService.update(id, input), "Customer updated successfully");
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("customers:delete", request);
  const { id } = await ctx.params;
  return ok(await customerService.remove(id), "Customer deleted successfully");
});
