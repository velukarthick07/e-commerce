"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import type { QuoteDto } from "@/types/models";

export interface CartLine {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  availableStock: number;
}

export function OrderSummary({
  lines,
  quote,
  quoting,
  onQuantityChange,
  onRemove,
}: {
  lines: CartLine[];
  quote: QuoteDto | null;
  quoting: boolean;
  onQuantityChange: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        title="Cart is empty"
        description="Scan a barcode or search for a product to start this order."
        icon={<ShoppingCartOutlinedIcon />}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ maxHeight: { md: 320 }, overflowY: { md: "auto" }, mb: 2 }}>
        {lines.map((line, index) => (
          <Box key={line.variantId}>
            {index > 0 && <Divider />}
            <Box sx={{ py: 1.5 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 1 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
                    {line.productName}
                  </Typography>
                  <Typography variant="caption">
                    {line.variantName} · {formatMoney(line.unitPrice)} each
                    {line.mrp > line.unitPrice && (
                      <Box
                        component="span"
                        sx={{ textDecoration: "line-through", ml: 0.75, opacity: 0.7 }}
                      >
                        {formatMoney(line.mrp)}
                      </Box>
                    )}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {formatMoney(line.unitPrice * line.quantity)}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => onQuantityChange(line.variantId, line.quantity - 1)}
                    aria-label={`Decrease ${line.productName}`}
                  >
                    <RemoveIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <Typography
                    sx={{ minWidth: 30, textAlign: "center", fontSize: 14, fontWeight: 600 }}
                  >
                    {line.quantity}
                  </Typography>
                  <IconButton
                    size="small"
                    disabled={line.quantity >= line.availableStock}
                    onClick={() => onQuantityChange(line.variantId, line.quantity + 1)}
                    aria-label={`Increase ${line.productName}`}
                  >
                    <AddIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>

                {line.quantity >= line.availableStock && (
                  <Typography variant="caption" sx={{ color: "warning.main" }}>
                    Max stock
                  </Typography>
                )}

                <Box sx={{ flex: 1 }} />

                <IconButton
                  size="small"
                  onClick={() => onRemove(line.variantId)}
                  aria-label={`Remove ${line.productName}`}
                  sx={{ color: "error.main" }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mb: 1.5 }} />

      {/* Totals come from the server so the screen always matches the charge */}
      <Box sx={{ display: "grid", gap: 0.85 }}>
        <Row label="Subtotal" value={quote?.subtotal} loading={quoting} />
        {(quote?.itemDiscount ?? 0) > 0 && (
          <Row label="Product savings" value={-(quote?.itemDiscount ?? 0)} loading={quoting} muted />
        )}
        {(quote?.couponDiscount ?? 0) > 0 && (
          <Row
            label={`Coupon${quote?.appliedCoupon ? ` (${quote.appliedCoupon.code})` : ""}`}
            value={-(quote?.couponDiscount ?? 0)}
            loading={quoting}
            tone="success"
          />
        )}
        {(quote?.manualDiscount ?? 0) > 0 && (
          <Row label="Manual discount" value={-(quote?.manualDiscount ?? 0)} loading={quoting} tone="success" />
        )}
        <Row label="Tax (included)" value={quote?.taxAmount} loading={quoting} muted />
        <Row label="Delivery" value={quote?.deliveryCharge} loading={quoting} />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Total</Typography>
        {quoting ? (
          <Skeleton width={90} height={30} />
        ) : (
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: "primary.main" }}>
            {formatMoney(quote?.grandTotal ?? 0)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Row({
  label,
  value,
  loading,
  muted,
  tone,
}: {
  label: string;
  value?: number;
  loading?: boolean;
  muted?: boolean;
  tone?: "success";
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography sx={{ fontSize: 13.5, color: muted ? "text.secondary" : "text.primary" }}>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={64} height={18} />
      ) : (
        <Typography
          sx={{
            fontSize: 13.5,
            fontWeight: 600,
            color: tone === "success" ? "success.main" : muted ? "text.secondary" : "text.primary",
          }}
        >
          {formatMoney(value ?? 0)}
        </Typography>
      )}
    </Box>
  );
}
