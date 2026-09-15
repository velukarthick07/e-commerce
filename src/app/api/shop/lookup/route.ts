import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { phoneLookupSchema } from "@/validators/storefront.validator";
import { storefrontService } from "@/services/storefront.service";

/** "Have we seen this number before?" — returns masked hints only. */
export const POST = handle(async (request: NextRequest) => {
  const { phone } = await parseBody(request, phoneLookupSchema);
  return ok(await storefrontService.lookup(phone), "Lookup complete");
});
