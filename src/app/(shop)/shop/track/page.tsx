"use client";

import Link from "next/link";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { TrackOrderForm } from "@/components/shop/TrackOrderForm";
import { OrderDetailView } from "@/components/shop/OrderDetailView";
import { useShopAuth } from "@/context/ShopAuthContext";
import type { ShopOrder } from "@/types/shop";

export default function TrackPage() {
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const { customer } = useShopAuth();

  if (order) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Button onClick={() => setOrder(null)} sx={{ mb: 2 }}>
          ← Track another order
        </Button>
        <OrderDetailView order={order} />
      </Container>
    );
  }

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 5, md: 8 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={1} sx={{ mb: 3, alignItems: "center", textAlign: "center" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.light",
              color: "primary.main",
            }}
          >
            <LocalShippingOutlinedIcon />
          </Box>
          <Typography variant="h2">Track your order</Typography>
          <Typography variant="body2" color="text.secondary">
            No account needed — just your order number and mobile.
          </Typography>
        </Stack>

        <TrackOrderForm onFound={setOrder} />

        <Typography
          component={Link}
          href={customer ? "/shop/account" : "/shop/login"}
          variant="body2"
          sx={{
            display: "block",
            mt: 3,
            textAlign: "center",
            color: "primary.main",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {customer ? "See all my orders" : "Sign in to see all your orders"}
        </Typography>
      </Paper>
    </Container>
  );
}
