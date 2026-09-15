"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { OrderDetailView } from "./OrderDetailView";
import { TrackOrderForm } from "./TrackOrderForm";
import { useShopAuth } from "@/context/ShopAuthContext";
import { shopApi } from "@/services/api/shop";
import { recallOrderPhone } from "@/lib/shop/recent-order";
import type { ShopOrder } from "@/types/shop";

interface LoadState {
  key: string;
  order: ShopOrder | null;
  /** Set when we have no way to prove the visitor may see this order. */
  needsProof: boolean;
  error: string | null;
}

/**
 * Shows one order by number.
 *
 * Three ways in, in order of preference: the customer is signed in and it is
 * their order; they just placed it in this tab (the number and mobile are in
 * sessionStorage); or they supply the mobile number by hand.
 */
export function OrderConfirmationView({ orderNumber }: { orderNumber: string }) {
  const { customer, ready } = useShopAuth();
  const [state, setState] = useState<LoadState | null>(null);

  const key = `${orderNumber}|${ready ? (customer?.id ?? "guest") : "pending"}`;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void (async () => {
      try {
        if (customer) {
          const order = await shopApi.myOrder(orderNumber);
          if (!cancelled) setState({ key, order, needsProof: false, error: null });
          return;
        }

        const phone = recallOrderPhone(orderNumber);
        if (!phone) {
          if (!cancelled) setState({ key, order: null, needsProof: true, error: null });
          return;
        }

        const order = await shopApi.track(orderNumber, phone);
        if (!cancelled) setState({ key, order, needsProof: false, error: null });
      } catch {
        // Whatever went wrong, the shopper can always identify the order the
        // manual way.
        if (!cancelled) setState({ key, order: null, needsProof: true, error: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, orderNumber, customer, ready]);

  const loading = !ready || state?.key !== key;

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  if (state?.needsProof) {
    return (
      <Container maxWidth="xs" sx={{ py: { xs: 5, md: 8 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Confirm it&apos;s you
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter the mobile number used for order {orderNumber}.
          </Typography>
          <TrackOrderForm
            defaultOrderNumber={orderNumber}
            lockOrderNumber
            onFound={(order) =>
              setState({ key, order, needsProof: false, error: null })
            }
          />
        </Paper>
      </Container>
    );
  }

  if (!state?.order) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">We could not load that order.</Alert>
      </Container>
    );
  }

  const justPlaced = state.order.statusHistory.length <= 1;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      {justPlaced ? (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, sm: 3 },
            mb: 3,
            borderRadius: 3,
            borderColor: "success.main",
            bgcolor: "rgba(18,183,106,.06)",
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <CheckCircleOutlinedIcon color="success" sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h3">Thank you — your order is in</Typography>
              <Typography variant="body2" color="text.secondary">
                We&apos;ll confirm it shortly and keep you posted. Save your order
                number to track it any time.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ) : null}

      <OrderDetailView order={state.order} />
    </Container>
  );
}
