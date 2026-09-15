import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { validateCouponSchema } from "@/validators/coupon.validator";
import { couponService } from "@/services/coupon.service";

export const POST = handle(async (request: NextRequest) => {
  await requirePermission("coupons:read", request);
  const input = await parseBody(request, validateCouponSchema);
  const result = await couponService.validate(input.code, input.subtotal);
  return ok(result, `Coupon ${result.code} applied`);
});
