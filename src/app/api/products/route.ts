import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import {
  createProductSchema,
  listProductsQuery,
} from "@/validators/product.validator";
import { productService } from "@/services/product.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("products:read", request);
  const query = parseQuery(request, listProductsQuery);

  const { items, meta } = await productService.list({
    ...query,
    isActive: query.isActive === undefined ? undefined : query.isActive === "true",
    isFeatured:
      query.isFeatured === undefined ? undefined : query.isFeatured === "true",
  });

  return ok(items, "Products loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  const session = await requirePermission("products:create", request);
  const input = await parseBody(request, createProductSchema);
  const product = await productService.create(input, session);
  return created(product, "Product created successfully");
});
