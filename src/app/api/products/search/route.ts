import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { productSearchQuery } from "@/validators/product.validator";
import { productService } from "@/services/product.service";

/** Debounced type-ahead for the local-order screen. */
export const GET = handle(async (request: NextRequest) => {
  await requirePermission("products:read", request);
  const query = parseQuery(request, productSearchQuery);
  return ok(await productService.search(query), "Products found");
});
