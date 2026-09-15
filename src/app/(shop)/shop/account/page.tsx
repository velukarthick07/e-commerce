"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { AccountOrders } from "@/components/shop/AccountOrders";
import { AccountAddresses } from "@/components/shop/AccountAddresses";
import { AccountProfile } from "@/components/shop/AccountProfile";
import { useShopAuth } from "@/context/ShopAuthContext";
import { formatPhone } from "@/lib/phone";

const TABS = [
  { value: "orders", label: "My orders" },
  { value: "addresses", label: "Addresses" },
  { value: "profile", label: "Profile" },
];

function AccountTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab") ?? "orders";
  const tab = TABS.some((t) => t.value === requested) ? requested : "orders";

  return (
    <>
      <Tabs
        value={tab}
        onChange={(_, next: string) => router.replace(`${pathname}?tab=${next}`, { scroll: false })}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        {TABS.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </Tabs>

      {tab === "orders" ? <AccountOrders /> : null}
      {tab === "addresses" ? <AccountAddresses /> : null}
      {tab === "profile" ? <AccountProfile /> : null}
    </>
  );
}

export default function AccountPage() {
  const { customer, ready } = useShopAuth();

  // The proxy already bounces signed-out visitors to /shop/login; this only
  // covers the moment before the session has been read.
  if (!ready) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h1">
          {customer ? `Hello, ${customer.name.split(" ")[0]}` : "My account"}
        </Typography>
        {customer ? (
          <Typography variant="body2" color="text.secondary">
            {formatPhone(customer.phone)}
            {customer.totalOrders
              ? ` · ${customer.totalOrders} order${customer.totalOrders === 1 ? "" : "s"}`
              : ""}
          </Typography>
        ) : null}
      </Stack>

      <Box>
        <Suspense fallback={<CircularProgress />}>
          <AccountTabs />
        </Suspense>
      </Box>
    </Container>
  );
}
