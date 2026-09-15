import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updatePaymentSchema } from "@/validators/payment.validator";
import { paymentService } from "@/services/payment.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("payments:read", request);
  const { id } = await ctx.params;
  return ok(await paymentService.getById(id), "Payment loaded");
});

export const PATCH = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("payments:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, updatePaymentSchema);
  return ok(
    await paymentService.update(id, input, session),
    `Payment marked ${input.status.toLowerCase()}`
  );
});
