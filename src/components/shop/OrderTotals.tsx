"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { formatMoney } from "@/lib/format";
import type { ShopQuote } from "@/types/shop";

function Row({
  label,
  value,
  emphasis,
  positive,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasis?: boolean;
  positive?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography
        variant={emphasis ? "h5" : "body2"}
        color={emphasis ? "text.primary" : "text.secondary"}
      >
        {label}
      </Typography>
      <Typography
        variant={emphasis ? "h5" : "body2"}
        sx={{ fontWeight: emphasis ? 700 : 500 }}
        color={positive ? "success.main" : "text.primary"}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export function OrderTotals({
  quote,
  stale,
  showFreeDeliveryProgress = true,
}: {
  quote: ShopQuote | null;
  stale?: boolean;
  showFreeDeliveryProgress?: boolean;
}) {
  if (!quote) {
    return (
      <Stack spacing={1.25}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={20} />
        ))}
        <Skeleton height={30} />
      </Stack>
    );
  }

  const progress =
    quote.freeDeliveryAbove > 0
      ? Math.min(
          100,
          ((quote.freeDeliveryAbove - quote.amountToFreeDelivery) /
            quote.freeDeliveryAbove) *
            100
        )
      : 100;

  return (
    <Stack spacing={1.25} sx={{ opacity: stale ? 0.6 : 1, transition: "opacity .15s" }}>
      <Row label="Item total" value={formatMoney(quote.subtotal)} />

      {quote.itemDiscount > 0 ? (
        <Row
          label="Product savings"
          value={`− ${formatMoney(quote.itemDiscount)}`}
          positive
        />
      ) : null}

      {quote.couponDiscount > 0 ? (
        <Row
          label={`Coupon ${quote.appliedCoupon?.code ?? ""}`}
          value={`− ${formatMoney(quote.couponDiscount)}`}
          positive
        />
      ) : null}

      <Row
        label="Delivery"
        value={
          quote.deliveryCharge > 0 ? formatMoney(quote.deliveryCharge) : "Free"
        }
        positive={quote.deliveryCharge === 0}
      />

      {quote.taxAmount > 0 ? (
        <Typography variant="caption">
          Includes {formatMoney(quote.taxAmount)} tax
        </Typography>
      ) : null}

      <Divider />
      <Row label="To pay" value={formatMoney(quote.grandTotal)} emphasis />

      {showFreeDeliveryProgress && quote.amountToFreeDelivery > 0 ? (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.75 }}>
            <LocalShippingOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ color: "text.primary" }}>
              Add {formatMoney(quote.amountToFreeDelivery)} more for free delivery
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      ) : null}
    </Stack>
  );
}
