import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { customerService } from "@/services/customer.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("customers:read", request);
  const { id } = await ctx.params;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  return ok(await customerService.orderHistory(id, limit), "Order history loaded");
});
