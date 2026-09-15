import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updatePaymentStatusSchema } from "@/validators/order.validator";
import { orderService } from "@/services/order.service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("payments:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, updatePaymentStatusSchema);

  const order = await orderService.updatePaymentStatus(id, input.paymentStatus, session, {
    transactionId: input.transactionId || undefined,
  });
  return ok(order, `Payment marked ${input.paymentStatus.toLowerCase()}`);
});
