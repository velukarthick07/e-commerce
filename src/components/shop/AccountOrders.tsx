"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { ProductImage } from "./ProductImage";
import { shopApi } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";
import { formatDateTime, formatMoney, humanise } from "@/lib/format";
import type { ShopOrderSummary } from "@/types/shop";

function statusColour(status: string) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "CANCELLED" || status === "RETURNED") return "error" as const;
  return "primary" as const;
}

export function AccountOrders() {
  const [snapshot, setSnapshot] = useState<{
    orders: ShopOrderSummary[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const orders = await shopApi.myOrders();
        if (!cancelled) setSnapshot({ orders, error: null });
      } catch (error) {
        if (!cancelled) {
          setSnapshot({
            orders: [],
            error:
              error instanceof ApiError ? error.message : "Could not load your orders",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!snapshot) {
    return (
      <Stack spacing={1.5}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={104} />
        ))}
      </Stack>
    );
  }

  if (snapshot.error) return <Alert severity="error">{snapshot.error}</Alert>;

  if (snapshot.orders.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderStyle: "dashed" }}>
        <ReceiptLongOutlinedIcon sx={{ fontSize: 44, color: "text.disabled", mb: 1 }} />
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          No orders yet
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          When you place an order it will show up here.
        </Typography>
        <Button component={Link} href="/shop" variant="contained">
          Start shopping
        </Button>
      </Paper>
    );
  }

  return (
    <Stack spacing={1.5}>
      {snapshot.orders.map((order) => (
        <Card
          key={order.id}
          variant="outlined"
          component={Link}
          href={`/shop/order/${order.orderNumber}`}
          sx={{
            p: 2,
            textDecoration: "none",
            display: "block",
            "&:hover": { borderColor: "primary.main" },
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 1.5 }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
                {order.orderNumber}
              </Typography>
              <Typography variant="caption">{formatDateTime(order.placedAt)}</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip size="small" label={humanise(order.status)} color={statusColour(order.status)} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
                {formatMoney(order.grandTotal)}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {order.items.map((item, index) => (
              <Box key={`${order.id}-${index}`} sx={{ width: 44, flexShrink: 0 }}>
                <ProductImage src={item.imageUrl} alt={item.productName} />
              </Box>
            ))}
            <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>
              {order._count.items} item{order._count.items === 1 ? "" : "s"}
              {order._count.items > order.items.length
                ? ` · ${order.items[0]?.productName} and more`
                : ` · ${order.items.map((i) => i.productName).join(", ")}`}
            </Typography>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
