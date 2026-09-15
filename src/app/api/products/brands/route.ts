import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { productService } from "@/services/product.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("products:read", request);
  return ok(await productService.distinctBrands(), "Brands loaded");
});
