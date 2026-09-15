import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateCouponSchema } from "@/validators/coupon.validator";
import { couponService } from "@/services/coupon.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("coupons:read", request);
  const { id } = await ctx.params;
  return ok(await couponService.getById(id), "Coupon loaded");
});

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("coupons:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, updateCouponSchema);
  return ok(await couponService.update(id, input), "Coupon updated successfully");
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("coupons:delete", request);
  const { id } = await ctx.params;
  return ok(await couponService.remove(id), "Coupon deleted successfully");
});
