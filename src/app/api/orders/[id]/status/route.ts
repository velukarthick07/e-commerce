import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateOrderStatusSchema } from "@/validators/order.validator";
import { orderService } from "@/services/order.service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("orders:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, updateOrderStatusSchema);

  const order = await orderService.updateStatus(id, input.status, session, input.note);
  return ok(order, `Order marked ${input.status.replace(/_/g, " ").toLowerCase()}`);
});
