"use client";

import { useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { ProductImage } from "@/components/shop/ProductImage";
import { QuantityStepper } from "@/components/shop/QuantityStepper";
import { OrderTotals } from "@/components/shop/OrderTotals";
import { CouponField } from "@/components/shop/CouponField";
import { useCart } from "@/hooks/useCart";
import { useShopQuote } from "@/hooks/useShopQuote";
import { formatMoney } from "@/lib/format";

export default function CartPage() {
  const { items, setQuantity, remove, isEmpty } = useCart();
  const [coupon, setCoupon] = useState("");

  // Delivery is priced as DELIVERY here so the cart shows the worst case;
  // choosing store pickup at checkout can only reduce it.
  const { quote, error, stale } = useShopQuote(items, coupon, "DELIVERY");

  // A coupon the server rejected is dropped from the summary but kept in the
  // box, so the shopper can see and correct what they typed.
  const couponError = coupon && quote && !quote.appliedCoupon ? error : null;
  const appliedCoupon = quote?.appliedCoupon?.code ?? null;

  if (isEmpty) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderStyle: "dashed" }}>
          <ShoppingCartOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }} />
          <Typography variant="h3" sx={{ mb: 1 }}>
            Your cart is empty
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Browse the range and add what you need — no account required.
          </Typography>
          <Button component={Link} href="/shop" variant="contained" size="large">
            Start shopping
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Your cart
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
          alignItems: "start",
        }}
      >
        <Stack spacing={1.5}>
          {items.map((line) => (
            <Card key={line.variantId} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                <Box
                  component={Link}
                  href={`/shop/p/${line.slug}`}
                  sx={{ width: 78, flexShrink: 0 }}
                >
                  <ProductImage src={line.imageUrl} alt={line.productName} />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    component={Link}
                    href={`/shop/p/${line.slug}`}
                    variant="subtitle1"
                    sx={{ fontWeight: 600, color: "text.primary", textDecoration: "none" }}
                  >
                    {line.productName}
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block" }}>
                    {line.variantName}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1.5, alignItems: "center", flexWrap: "wrap", gap: 1 }}
                  >
                    <QuantityStepper
                      size="small"
                      removable
                      value={line.quantity}
                      max={line.availableStock}
                      onChange={(next) => setQuantity(line.variantId, next)}
                    />
                    <Typography variant="body2" color="text.secondary">
                      × {formatMoney(line.unitPrice)}
                    </Typography>
                  </Stack>
                </Box>

                <Stack sx={{ alignItems: "flex-end" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {formatMoney(line.unitPrice * line.quantity)}
                  </Typography>
                  {line.mrp > line.unitPrice ? (
                    <Typography
                      variant="caption"
                      sx={{ textDecoration: "line-through" }}
                    >
                      {formatMoney(line.mrp * line.quantity)}
                    </Typography>
                  ) : null}
                  <IconButton
                    size="small"
                    onClick={() => remove(line.variantId)}
                    aria-label={`Remove ${line.productName}`}
                    sx={{ mt: 0.5, color: "text.disabled" }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}

          <Button component={Link} href="/shop" sx={{ alignSelf: "flex-start" }}>
            ← Continue shopping
          </Button>
        </Stack>

        <Paper
          variant="outlined"
          sx={{ p: 2.5, borderRadius: 3, position: { md: "sticky" }, top: { md: 96 } }}
        >
          <Typography variant="h4" sx={{ mb: 2 }}>
            Order summary
          </Typography>

          <CouponField
            applied={appliedCoupon}
            error={couponError}
            onApply={setCoupon}
            onClear={() => setCoupon("")}
          />

          <Divider sx={{ my: 2 }} />

          {error && !couponError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <OrderTotals quote={quote} stale={stale} />

          <Button
            component={Link}
            href="/shop/checkout"
            variant="contained"
            size="large"
            fullWidth
            disabled={!quote}
            sx={{ mt: 2.5 }}
          >
            Proceed to checkout
          </Button>

          <Typography variant="caption" sx={{ display: "block", mt: 1.5, textAlign: "center" }}>
            Delivery is recalculated once you choose delivery or pickup.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
