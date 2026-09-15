import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { storefrontQuoteSchema } from "@/validators/storefront.validator";
import { storefrontService } from "@/services/storefront.service";

/**
 * Server-authoritative cart pricing. The cart and checkout both render these
 * numbers, and `POST /api/shop/orders` recomputes them the same way, so what
 * the shopper sees is what the shop charges.
 */
export const POST = handle(async (request: NextRequest) => {
  const input = await parseBody(request, storefrontQuoteSchema);
  return ok(await storefrontService.quote(input), "Totals calculated");
});
