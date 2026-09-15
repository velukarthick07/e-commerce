import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { createCouponSchema, listCouponsQuery } from "@/validators/coupon.validator";
import { couponService } from "@/services/coupon.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("coupons:read", request);
  const query = parseQuery(request, listCouponsQuery);
  const { items, meta } = await couponService.list({
    ...query,
    isActive: query.isActive === undefined ? undefined : query.isActive === "true",
  });
  return ok(items, "Coupons loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  await requirePermission("coupons:create", request);
  const input = await parseBody(request, createCouponSchema);
  return created(await couponService.create(input), "Coupon created successfully");
});
