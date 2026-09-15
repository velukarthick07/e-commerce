import { handle, ok } from "@/lib/api-response";
import { storefrontService } from "@/services/storefront.service";

export const GET = handle(async () => {
  return ok(await storefrontService.categories(), "Categories loaded");
});
