import Box from "@mui/material/Box";
import type { Metadata } from "next";
import { ShopAuthProvider } from "@/context/ShopAuthContext";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { storefrontService } from "@/services/storefront.service";
import { serialize } from "@/lib/serialize";
import type { StoreInfo } from "@/types/shop";

/**
 * Every storefront page renders the store's name, contact details and delivery
 * rules in its header and footer, all of which come from the database.
 *
 * That makes this whole segment per-request. Prerendering it would bake the
 * store's details into the HTML at build time, which is wrong twice over: on a
 * new server the build runs *before* setup, when no database exists yet and
 * there is no store to name; and afterwards, renaming the store under Settings
 * would not reach these pages until someone rebuilt the application.
 */
export const dynamic = "force-dynamic";

/**
 * Shop tabs read "<page> · <store name>". `absolute` is what stops the root
 * layout's "%s · FMCG Admin" template from following the storefront around —
 * shoppers should never see the admin panel's name.
 */
export async function generateMetadata(): Promise<Metadata> {
  const store = await storefrontService.storeInfo();
  return {
    title: { absolute: store.storeName, template: `%s · ${store.storeName}` },
    description:
      "Order cold-pressed oils, millets, health mixes, spices and everyday groceries for delivery or store pickup.",
  };
}

/**
 * Store details (name, delivery rules, payment methods) are read on the server
 * so the header and footer render correctly on first paint, with no loading
 * flicker and no extra round trip from the browser.
 */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [info, brands] = await Promise.all([
    storefrontService.storeInfo(),
    storefrontService.brands(),
  ]);
  const store = serialize({ ...info, brands }) as StoreInfo;

  return (
    <ShopAuthProvider>
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
        }}
      >
        <ShopHeader store={store} />
        <Box component="main" sx={{ flex: 1 }}>
          {children}
        </Box>
        <ShopFooter store={store} />
      </Box>
    </ShopAuthProvider>
  );
}
