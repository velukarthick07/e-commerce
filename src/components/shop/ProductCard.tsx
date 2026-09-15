"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/context/ToastContext";
import { ProductImage } from "./ProductImage";
import { QuantityStepper } from "./QuantityStepper";
import type { ShopProduct } from "@/types/shop";

export function ProductCard({ product }: { product: ShopProduct }) {
  const { items, add, setQuantity } = useCart();
  const toast = useToast();

  // Default to the first variant that can actually be bought, so the card
  // never opens on a sold-out size when another size is available.
  const [variantId, setVariantId] = useState(
    () =>
      product.variants.find((v) => v.inStock && v.isDefault)?.id ??
      product.variants.find((v) => v.inStock)?.id ??
      product.variants[0]?.id ??
      ""
  );

  const variant =
    product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const inCart = items.find((l) => l.variantId === variant?.id);

  if (!variant) return null;

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
    toast.success(`${product.name} added to cart`);
  }

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        p: 1.5,
        containerType: "inline-size",
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: "0 8px 24px rgba(127,86,217,.10)",
        },
      }}
    >
      <Box sx={{ position: "relative" }}>
        <Box component={Link} href={`/shop/p/${product.slug}`} sx={{ display: "block" }}>
          <ProductImage
            src={variant.imageUrl ?? product.images[0]}
            alt={product.name}
          />
        </Box>

        {variant.discountPercent > 0 ? (
          <Chip
            size="small"
            label={`${variant.discountPercent}% off`}
            color="success"
            sx={{ position: "absolute", top: 8, left: 8, fontWeight: 600 }}
          />
        ) : null}

        {!product.inStock ? (
          <Chip
            size="small"
            label="Out of stock"
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(24,24,27,.78)",
              color: "#fff",
              fontWeight: 600,
            }}
          />
        ) : null}
      </Box>

      <Stack spacing={0.5} sx={{ mt: 1.5, flex: 1 }}>
        {product.brand ? (
          <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: ".04em" }}>
            {product.brand}
          </Typography>
        ) : null}

        <Typography
          component={Link}
          href={`/shop/p/${product.slug}`}
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            color: "text.primary",
            textDecoration: "none",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.3,
            "&:hover": { color: "primary.main" },
          }}
        >
          {product.name}
        </Typography>

        {product.variants.length > 1 ? (
          <TextField
            select
            size="small"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            aria-label="Choose a size"
            sx={{ mt: 0.75, "& .MuiInputBase-input": { py: 0.75, fontSize: 13 } }}
          >
            {product.variants.map((v) => (
              <MenuItem key={v.id} value={v.id} disabled={!v.inStock}>
                {v.name}
                {v.inStock ? "" : " — sold out"}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Typography variant="caption">
            {variant.name}
            {product.netQuantity ? ` · ${product.netQuantity}` : ""}
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          mt: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography component="span" variant="h5" sx={{ fontWeight: 700 }}>
            {formatMoney(variant.effectivePrice)}
          </Typography>
          {variant.savings > 0 ? (
            <Typography
              component="span"
              variant="body2"
              sx={{ ml: 0.75, color: "text.secondary", textDecoration: "line-through" }}
            >
              {formatMoney(variant.mrp)}
            </Typography>
          ) : null}
        </Box>

        {!variant.inStock ? (
          <Button size="small" disabled variant="outlined">
            Sold out
          </Button>
        ) : inCart ? (
          <QuantityStepper
            size="small"
            removable
            value={inCart.quantity}
            max={variant.availableStock}
            onChange={(next) => setQuantity(variant.id, next)}
          />
        ) : (
          <Button size="small" variant="contained" onClick={handleAdd}>
            Add
          </Button>
        )}
      </Box>
    </Card>
  );
}
