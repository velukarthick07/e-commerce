"use client";

import Chip from "@mui/material/Chip";
import type { ChipProps } from "@mui/material/Chip";
import { humanise } from "@/lib/format";

type Tone = "default" | "primary" | "success" | "warning" | "error" | "info";

const ORDER_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PROCESSING: "info",
  PACKED: "primary",
  SHIPPED: "primary",
  OUT_FOR_DELIVERY: "primary",
  DELIVERED: "success",
  CANCELLED: "error",
  RETURNED: "error",
};

const PAYMENT_STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "error",
  REFUNDED: "info",
};

const STOCK_TONE: Record<string, Tone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "error",
};

const EXPIRY_TONE: Record<string, Tone> = {
  expired: "error",
  "7_days": "warning",
  "30_days": "warning",
  "60_days": "info",
  normal: "success",
};

const TX_TONE: Record<string, Tone> = {
  STOCK_ADDED: "success",
  RETURN: "success",
  ORDER_DEDUCTION: "info",
  STOCK_REMOVED: "warning",
  MANUAL_ADJUSTMENT: "primary",
  EXPIRED_STOCK: "error",
};

const MAPS = {
  order: ORDER_STATUS_TONE,
  payment: PAYMENT_STATUS_TONE,
  stock: STOCK_TONE,
  expiry: EXPIRY_TONE,
  transaction: TX_TONE,
} as const;

const LABELS: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  expired: "Expired",
  "7_days": "Within 7 days",
  "30_days": "Within 30 days",
  "60_days": "Within 60 days",
  normal: "Normal",
};

export function StatusChip({
  value,
  kind = "order",
  size = "small",
  label,
}: {
  value: string;
  kind?: keyof typeof MAPS;
  size?: ChipProps["size"];
  label?: string;
}) {
  const tone = MAPS[kind][value] ?? "default";
  const text = label ?? LABELS[value] ?? humanise(value);

  if (tone === "default") {
    return <Chip size={size} label={text} variant="outlined" />;
  }

  return (
    <Chip
      size={size}
      label={text}
      sx={{
        bgcolor: (t) =>
          tone === "primary"
            ? t.palette.primary.light
            : `${t.palette[tone].main}1A`,
        color: (t) => t.palette[tone].main,
        border: "none",
      }}
    />
  );
}
