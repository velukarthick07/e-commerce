import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requireCustomer } from "@/lib/customer-auth";
import { storefrontService } from "@/services/storefront.service";

type Ctx = { params: Promise<{ orderNumber: string }> };

/** Scoped to the caller's own orders; guests use POST /api/shop/track. */
export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requireCustomer(request);
  const { orderNumber } = await ctx.params;
  return ok(
    await storefrontService.myOrder(session.customerId, orderNumber),
    "Order loaded"
  );
});
