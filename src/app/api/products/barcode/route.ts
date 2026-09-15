import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { barcodeLookupQuery } from "@/validators/product.validator";
import { productService } from "@/services/product.service";

/** Resolves a scanned barcode (or SKU) straight to a sellable variant. */
export const GET = handle(async (request: NextRequest) => {
  await requirePermission("products:read", request);
  const { barcode } = parseQuery(request, barcodeLookupQuery);
  return ok(await productService.lookupBarcode(barcode), "Product found");
});
