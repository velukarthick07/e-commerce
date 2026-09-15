import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { orderService } from "@/services/order.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("orders:read", request);
  const { id } = await ctx.params;
  return ok(await orderService.getById(id), "Order loaded");
});
