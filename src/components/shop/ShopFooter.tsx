import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { TextLink } from "./ShopLink";
import { formatMoney } from "@/lib/format";
import type { StoreInfo } from "@/types/shop";

const LINKS = [
  { label: "All products", href: "/shop" },
  { label: "Track an order", href: "/shop/track" },
  { label: "Your cart", href: "/shop/cart" },
];

export function ShopFooter({ store }: { store: StoreInfo }) {
  return (
    <Box
      component="footer"
      sx={{ mt: 8, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}
    >
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={4}
          sx={{ justifyContent: "space-between" }}
        >
          <Box sx={{ maxWidth: 320 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {store.storeName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cold-pressed oils, millets, spices and everyday groceries —
              delivered fresh from our store.
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Quick links
            </Typography>
            <Stack spacing={0.75}>
              {LINKS.map((link) => (
                <TextLink key={link.href} href={link.href} muted sx={{ fontSize: 14 }}>
                  {link.label}
                </TextLink>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Delivery
            </Typography>
            <Stack spacing={0.75}>
              <Typography variant="body2" color="text.secondary">
                {store.delivery.freeDeliveryAbove > 0
                  ? `Free delivery over ${formatMoney(store.delivery.freeDeliveryAbove, store.currencySymbol)}`
                  : "Free delivery on every order"}
              </Typography>
              {store.delivery.enablePickup ? (
                <Typography variant="body2" color="text.secondary">
                  Store pickup available
                </Typography>
              ) : null}
              {store.phone ? (
                <Typography variant="body2" color="text.secondary">
                  {store.phone}
                </Typography>
              ) : null}
              {store.city ? (
                <Typography variant="body2" color="text.secondary">
                  {[store.city, store.state].filter(Boolean).join(", ")}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ my: 3 }} />
        <Typography variant="caption">
          © {new Date().getFullYear()} {store.storeName}. Prices include all
          applicable taxes.
        </Typography>
      </Container>
    </Box>
  );
}
