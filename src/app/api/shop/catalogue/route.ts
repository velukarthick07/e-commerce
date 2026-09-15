import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { catalogueQuery } from "@/validators/storefront.validator";
import { storefrontService } from "@/services/storefront.service";

/** Public product listing. No session of any kind is required. */
export const GET = handle(async (request: NextRequest) => {
  const query = parseQuery(request, catalogueQuery);
  const { items, meta } = await storefrontService.catalogue(query);
  return ok(items, "Products loaded", { meta });
});
