"use client";

import { useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/context/ToastContext";
import { QuantityStepper } from "./QuantityStepper";
import type { ShopProductDetail } from "@/types/shop";

export function ProductPurchasePanel({
  product,
  onVariantChange,
}: {
  product: ShopProductDetail;
  onVariantChange?: (variantId: string) => void;
}) {
  const { items, add, setQuantity } = useCart();
  const toast = useToast();

  const [variantId, setVariantId] = useState(
    () =>
      product.variants.find((v) => v.inStock && v.isDefault)?.id ??
      product.variants.find((v) => v.inStock)?.id ??
      product.variants[0]?.id ??
      ""
  );

  const variant =
    product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  if (!variant) return null;

  const inCart = items.find((l) => l.variantId === variant.id);

  function select(next: string) {
    if (!next) return;
    setVariantId(next);
    onVariantChange?.(next);
  }

  function handleAdd() {
    add({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      productName: product.name,
      variantName: variant.name,
      imageUrl: variant.imageUrl ?? product.images[0] ?? null,
      unit: product.unit,
      unitPrice: variant.effectivePrice,
      mrp: variant.mrp,
      quantity: 1,
      availableStock: variant.availableStock,
    });
    toast.success(`${product.name} (${variant.name}) added to cart`);
  }

  return (
    <Stack spacing={2.5}>
      {product.variants.length > 1 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Size
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={variantId}
            onChange={(_, next: string | null) => next && select(next)}
            sx={{ flexWrap: "wrap", gap: 1, "& .MuiToggleButton-root": { borderRadius: 2 } }}
          >
            {product.variants.map((v) => (
              <ToggleButton
                key={v.id}
                value={v.id}
                disabled={!v.inStock}
                sx={{ px: 2, py: 1, textTransform: "none", border: "1px solid !important", borderColor: "divider !important" }}
              >
                <Stack spacing={0.25} sx={{ alignItems: "flex-start" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {v.name}
                  </Typography>
                  <Typography variant="caption">
                    {v.inStock ? formatMoney(v.effectivePrice) : "Sold out"}
                  </Typography>
                </Stack>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      ) : null}

      <Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography variant="h1" sx={{ fontWeight: 700 }}>
            {formatMoney(variant.effectivePrice)}
          </Typography>
          {variant.savings > 0 ? (
            <>
              <Typography
                variant="h4"
                sx={{ color: "text.secondary", textDecoration: "line-through", fontWeight: 400 }}
              >
                {formatMoney(variant.mrp)}
              </Typography>
              <Chip
                size="small"
                color="success"
                label={`Save ${formatMoney(variant.savings)}`}
                sx={{ fontWeight: 600 }}
              />
            </>
          ) : null}
        </Stack>
        <Typography variant="caption">
          Inclusive of all taxes · {variant.name}
        </Typography>
      </Box>

      {!variant.inStock ? (
        <Alert severity="warning">
          This size is sold out. Try another size, or check back soon.
        </Alert>
      ) : variant.availableStock <= 5 ? (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Only {variant.availableStock} left in stock.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        {inCart ? (
          <>
            <QuantityStepper
              value={inCart.quantity}
              max={variant.availableStock}
              removable
              onChange={(next) => setQuantity(variant.id, next)}
            />
            <Button
              component={Link}
              href="/shop/cart"
              variant="contained"
              size="large"
              startIcon={<ShoppingCartOutlinedIcon />}
            >
              Go to cart
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            size="large"
            disabled={!variant.inStock}
            onClick={handleAdd}
            startIcon={<ShoppingCartOutlinedIcon />}
            sx={{ minWidth: 200 }}
          >
            Add to cart
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
