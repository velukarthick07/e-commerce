import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { trackOrderSchema } from "@/validators/storefront.validator";
import { storefrontService } from "@/services/storefront.service";

/** Guest order tracking: order number + the mobile it was placed with. */
export const POST = handle(async (request: NextRequest) => {
  const { orderNumber, phone } = await parseBody(request, trackOrderSchema);
  return ok(await storefrontService.track(orderNumber, phone), "Order found");
});
