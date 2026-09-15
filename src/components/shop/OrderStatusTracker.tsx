"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import { formatDateTime, humanise } from "@/lib/format";
import type { ShopOrder } from "@/types/shop";

/**
 * The happy path a shopper's order walks. SHIPPED and OUT_FOR_DELIVERY are
 * folded into one visible step — the distinction matters to the warehouse,
 * not to the person waiting at home.
 */
const STEPS: { key: string; label: string; matches: string[] }[] = [
  { key: "placed", label: "Order placed", matches: ["PENDING"] },
  { key: "confirmed", label: "Confirmed", matches: ["CONFIRMED"] },
  { key: "packed", label: "Packed", matches: ["PROCESSING", "PACKED"] },
  { key: "shipped", label: "On the way", matches: ["SHIPPED", "OUT_FOR_DELIVERY"] },
  { key: "delivered", label: "Delivered", matches: ["DELIVERED"] },
];

export function OrderStatusTracker({ order }: { order: ShopOrder }) {
  if (order.status === "CANCELLED") {
    return (
      <Alert severity="error">
        This order was cancelled
        {order.cancelledAt ? ` on ${formatDateTime(order.cancelledAt)}` : ""}. Any
        stock has been returned to the shelf — nothing is owed.
      </Alert>
    );
  }

  if (order.status === "RETURNED") {
    return <Alert severity="warning">This order was returned to the store.</Alert>;
  }

  // The furthest step the order has actually reached, taken from its history
  // rather than its current status, so a skipped step still shows as done.
  const seen = new Set(order.statusHistory.map((h) => h.status as string));
  seen.add(order.status);
  const lastDone = STEPS.reduce(
    (acc, step, index) => (step.matches.some((m) => seen.has(m)) ? index : acc),
    0
  );

  const timeFor = (matches: string[]) =>
    order.statusHistory.find((h) => matches.includes(h.status))?.createdAt ?? null;

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <Stepper
        activeStep={lastDone}
        alternativeLabel
        sx={{ minWidth: 520, "& .MuiStepLabel-label": { mt: 1 } }}
      >
        {STEPS.map((step) => {
          const at = timeFor(step.matches);
          return (
            <Step key={step.key} completed={Boolean(at)}>
              <StepLabel>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {step.label}
                </Typography>
                {at ? (
                  <Typography variant="caption" sx={{ display: "block" }}>
                    {formatDateTime(at)}
                  </Typography>
                ) : null}
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
      <Typography
        variant="caption"
        sx={{ display: "block", textAlign: "center", mt: 1 }}
      >
        Current status: {humanise(order.status)}
      </Typography>
    </Box>
  );
}
