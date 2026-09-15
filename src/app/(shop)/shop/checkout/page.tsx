import { CheckoutView } from "@/components/shop/CheckoutView";
import { storefrontService } from "@/services/storefront.service";
import { serialize } from "@/lib/serialize";
import type { StoreInfo } from "@/types/shop";

export const metadata = { title: "Checkout" };

/**
 * Delivery options and accepted payment methods come from Settings, read on
 * the server so the form cannot offer a method the shop has switched off.
 */
export default async function CheckoutPage() {
  const [info, brands] = await Promise.all([
    storefrontService.storeInfo(),
    storefrontService.brands(),
  ]);
  const store = serialize({ ...info, brands }) as StoreInfo;

  return <CheckoutView store={store} />;
}
