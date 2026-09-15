import { handle, ok } from "@/lib/api-response";
import { storefrontService } from "@/services/storefront.service";

/** Shop name, contact details, delivery rules and accepted payment methods. */
export const GET = handle(async () => {
  const [info, brands] = await Promise.all([
    storefrontService.storeInfo(),
    storefrontService.brands(),
  ]);
  return ok({ ...info, brands }, "Store details loaded");
});
