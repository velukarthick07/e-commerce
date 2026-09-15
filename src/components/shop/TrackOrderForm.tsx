"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { shopApi } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";
import { rememberOrder } from "@/lib/shop/recent-order";
import type { ShopOrder } from "@/types/shop";

/**
 * Guest order tracking needs both the order number and the mobile it was
 * placed with. Order numbers run in a daily sequence, so requiring the number
 * as well is what stops anyone from walking the list.
 */
export function TrackOrderForm({
  defaultOrderNumber = "",
  lockOrderNumber = false,
  onFound,
}: {
  defaultOrderNumber?: string;
  lockOrderNumber?: boolean;
  onFound: (order: ShopOrder) => void;
}) {
  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const order = await shopApi.track(orderNumber, phone);
      rememberOrder(order.orderNumber, order.customerPhone);
      onFound(order);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not find that order. Please check the details."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}

        <TextField
          label="Order number"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
          disabled={lockOrderNumber}
          placeholder="ORD-20260912-0001"
          autoFocus={!lockOrderNumber}
          fullWidth
          slotProps={{ htmlInput: { style: { textTransform: "uppercase" } } }}
        />

        <TextField
          label="Mobile number used for the order"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          autoComplete="tel"
          autoFocus={lockOrderNumber}
          fullWidth
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">+91</InputAdornment>,
            },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          loading={busy}
          disabled={!orderNumber.trim() || phone.replace(/\D/g, "").length < 10}
        >
          Track order
        </Button>

        <Typography variant="caption">
          Signed-in customers can see every order without the order number.
        </Typography>
      </Stack>
    </Box>
  );
}
