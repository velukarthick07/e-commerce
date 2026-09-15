"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { ProductImage } from "./ProductImage";
import { OrderStatusTracker } from "./OrderStatusTracker";
import { formatDateTime, formatMoney, humanise } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { ShopOrder } from "@/types/shop";

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on delivery",
  UPI: "UPI on delivery",
  ONLINE_PAYMENT: "Paid online",
  CARD: "Card",
  CASH: "Cash",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function OrderDetailView({ order }: { order: ShopOrder }) {
  const payment = order.payments[0];

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
        >
          <Box>
            <Typography variant="h3">{order.orderNumber}</Typography>
            <Typography variant="body2" color="text.secondary">
              Placed {formatDateTime(order.placedAt)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              icon={
                order.deliveryType === "PICKUP" ? (
                  <StorefrontOutlinedIcon />
                ) : (
                  <HomeOutlinedIcon />
                )
              }
              label={order.deliveryType === "PICKUP" ? "Store pickup" : "Home delivery"}
              variant="outlined"
            />
            <Chip
              size="small"
              label={humanise(order.status)}
              color={
                order.status === "DELIVERED"
                  ? "success"
                  : order.status === "CANCELLED" || order.status === "RETURNED"
                    ? "error"
                    : "primary"
              }
            />
          </Stack>
        </Stack>

        <OrderStatusTracker order={order} />
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" },
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </Typography>
          <Stack spacing={2}>
            {order.items.map((item) => (
              <Stack key={item.id} direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 60, flexShrink: 0 }}>
                  <ProductImage src={item.imageUrl} alt={item.productName} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {item.product ? (
                    <Typography
                      component={Link}
                      href={`/shop/p/${item.product.slug}`}
                      variant="subtitle2"
                      sx={{ color: "text.primary", textDecoration: "none" }}
                    >
                      {item.productName}
                    </Typography>
                  ) : (
                    <Typography variant="subtitle2">{item.productName}</Typography>
                  )}
                  <Typography variant="caption" sx={{ display: "block" }}>
                    {item.variantName} · {item.quantity} × {formatMoney(item.unitPrice)}
                  </Typography>
                </Box>
                <Typography variant="subtitle2" sx={{ whiteSpace: "nowrap" }}>
                  {formatMoney(item.lineTotal)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h5" sx={{ mb: 1.5 }}>
              Payment summary
            </Typography>
            <Stack spacing={1}>
              <Row label="Item total" value={formatMoney(order.subtotal)} />
              {order.discountTotal > 0 ? (
                <Row label="Savings" value={`− ${formatMoney(order.discountTotal)}`} />
              ) : null}
              {order.couponCode ? <Row label="Coupon" value={order.couponCode} /> : null}
              <Row
                label="Delivery"
                value={order.deliveryCharge > 0 ? formatMoney(order.deliveryCharge) : "Free"}
              />
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="h5">Total</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {formatMoney(order.grandTotal)}
                </Typography>
              </Stack>
              {order.taxAmount > 0 ? (
                <Typography variant="caption">
                  Includes {formatMoney(order.taxAmount)} tax
                </Typography>
              ) : null}
              {payment ? (
                <Chip
                  size="small"
                  sx={{ alignSelf: "flex-start", mt: 1 }}
                  variant="outlined"
                  color={order.paymentStatus === "PAID" ? "success" : "default"}
                  label={`${PAYMENT_LABELS[payment.method] ?? payment.method} · ${humanise(order.paymentStatus)}`}
                />
              ) : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography variant="h5" sx={{ mb: 1.5 }}>
              {order.deliveryType === "PICKUP" ? "Collection" : "Delivering to"}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {order.customerName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatPhone(order.customerPhone)}
            </Typography>
            {order.deliveryType === "DELIVERY" ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {[
                  order.addressLine1,
                  order.addressLine2,
                  order.city,
                  order.state,
                  order.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Collect from the store — we&apos;ll call you when it&apos;s ready.
              </Typography>
            )}
            {order.deliveryNotes ? (
              <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                Note: {order.deliveryNotes}
              </Typography>
            ) : null}
          </Paper>

          <Button component={Link} href="/shop" variant="outlined" fullWidth>
            Continue shopping
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
