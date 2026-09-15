"use client";

import { use, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusChip } from "@/components/common/StatusChip";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useOne } from "@/hooks/useApiResource";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { patch, ApiError } from "@/services/api/client";
import { formatDate, formatDateTime, formatMoney, humanise } from "@/lib/format";
import type { OrderDetailDto } from "@/types/models";

/** Mirrors the server-side transition table so the UI only offers valid moves. */
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

const TIMELINE = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED",
  "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED",
];

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can } = useAuth();
  const toast = useToast();
  const { data: order, loading, error, reload } = useOne<OrderDetailDto>(`/orders/${id}`);

  const [nextStatus, setNextStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  const updateStatus = async () => {
    try {
      const result = await patch<OrderDetailDto>(`/orders/${id}/status`, {
        status: nextStatus,
        note: statusNote,
      });
      toast.success(result.message);
      setNextStatus("");
      setStatusNote("");
      setConfirmOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update the order status");
      setConfirmOpen(false);
    }
  };

  const markPaid = async () => {
    setSavingPayment(true);
    try {
      const result = await patch<OrderDetailDto>(`/orders/${id}/payment`, {
        paymentStatus: "PAID",
      });
      toast.success(result.message);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update the payment");
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Order" />
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" } }}>
          <Skeleton variant="rounded" height={420} />
          <Skeleton variant="rounded" height={420} />
        </Box>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <PageHeader title="Order" breadcrumbs={[{ label: "Orders", href: "/orders" }]} />
        <Alert severity="error">{error ?? "This order could not be found."}</Alert>
      </>
    );
  }

  const allowed = TRANSITIONS[order.status] ?? [];
  const reachedIndex = TIMELINE.indexOf(order.status);
  const terminated = order.status === "CANCELLED" || order.status === "RETURNED";

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${humanise(order.orderType)} · placed ${formatDateTime(order.placedAt)}`}
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: order.orderNumber },
        ]}
        actions={
          <Button
            variant="outlined"
            startIcon={<PrintOutlinedIcon />}
            onClick={() => window.print()}
            className="no-print"
          >
            Print receipt
          </Button>
        }
      />

      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <StatusChip value={order.status} kind="order" />
        <StatusChip value={order.paymentStatus} kind="payment" />
        <Chip size="small" variant="outlined" label={humanise(order.channel)} />
        <Chip size="small" variant="outlined" label={humanise(order.deliveryType)} />
        {order.couponCode && (
          <Chip size="small" variant="outlined" color="primary" label={`Coupon ${order.couponCode}`} />
        )}
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 2 }}>
          {/* Items */}
          <Card>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <Typography variant="h5" sx={{ p: 2.5, pb: 1.5 }}>
                Items ({order.items.length})
              </Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell align="right">Discount</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                            {item.productName}
                          </Typography>
                          <Typography variant="caption">
                            {item.variantName} · {item.sku}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 14 }}>{formatMoney(item.unitPrice)}</Typography>
                          {item.mrp > item.unitPrice && (
                            <Typography variant="caption" sx={{ textDecoration: "line-through" }}>
                              {formatMoney(item.mrp)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">
                          {item.discountAmount > 0 ? `−${formatMoney(item.discountAmount)}` : "—"}
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                            {formatMoney(item.lineTotal)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Box sx={{ p: 2.5, bgcolor: "#FAFAFC", borderTop: 1, borderColor: "divider" }}>
                <Box sx={{ maxWidth: 340, ml: "auto", display: "grid", gap: 0.85 }}>
                  <SummaryRow label="Subtotal" value={order.subtotal} />
                  {order.itemDiscount > 0 && (
                    <SummaryRow label="Product savings" value={-order.itemDiscount} muted />
                  )}
                  {order.couponDiscount > 0 && (
                    <SummaryRow label={`Coupon ${order.couponCode ?? ""}`} value={-order.couponDiscount} tone="success" />
                  )}
                  {order.manualDiscount > 0 && (
                    <SummaryRow label="Manual discount" value={-order.manualDiscount} tone="success" />
                  )}
                  <SummaryRow label="Tax (included)" value={order.taxAmount} muted />
                  <SummaryRow label="Delivery" value={order.deliveryCharge} />
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography sx={{ fontWeight: 700 }}>Grand total</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 18, color: "primary.main" }}>
                      {formatMoney(order.grandTotal)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2.5 }}>Timeline</Typography>

              {terminated ? (
                <Alert severity={order.status === "CANCELLED" ? "error" : "warning"} sx={{ mb: 2 }}>
                  This order was {humanise(order.status).toLowerCase()}
                  {order.cancelledAt ? ` on ${formatDateTime(order.cancelledAt)}` : ""}. Stock has
                  been returned to inventory.
                </Alert>
              ) : null}

              <Box sx={{ display: "grid", gap: 0 }}>
                {TIMELINE.map((step, index) => {
                  const history = order.statusHistory.find((h) => h.status === step);
                  const reached = reachedIndex >= index && !terminated;
                  const isLast = index === TIMELINE.length - 1;

                  return (
                    <Box key={step} sx={{ display: "flex", gap: 2 }}>
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            bgcolor: reached ? "primary.main" : "#E4E1EA",
                            flexShrink: 0,
                            mt: 0.6,
                          }}
                        />
                        {!isLast && (
                          <Box
                            sx={{
                              width: 2,
                              flex: 1,
                              minHeight: 28,
                              bgcolor: reachedIndex > index && !terminated ? "primary.main" : "#E4E1EA",
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ pb: isLast ? 0 : 2 }}>
                        <Typography
                          sx={{
                            fontSize: 14,
                            fontWeight: reached ? 600 : 400,
                            color: reached ? "text.primary" : "text.secondary",
                          }}
                        >
                          {humanise(step)}
                        </Typography>
                        {history && (
                          <Typography variant="caption">
                            {formatDateTime(history.createdAt)}
                            {history.note ? ` · ${history.note}` : ""}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Batch traceability */}
          {order.transactions.some((t) => t.batch) && (
            <Card>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 0.5 }}>Batch allocation</Typography>
                <Typography variant="caption" sx={{ display: "block", mb: 2 }}>
                  Stock was consumed first-expiry-first-out (FEFO)
                </Typography>
                <Box sx={{ display: "grid", gap: 1 }}>
                  {order.transactions
                    .filter((t) => t.batch)
                    .map((t) => {
                      const item = order.items.find((i) => i.variantId === t.variantId);
                      return (
                        <Box
                          key={t.id}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 2,
                            p: 1.25,
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 2,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 500 }} noWrap>
                              {item?.productName ?? "Product"} · {item?.variantName ?? ""}
                            </Typography>
                            <Typography variant="caption">
                              Batch {t.batch!.batchNumber} · expires {formatDate(t.batch!.expiryDate)}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0 }}>
                            {Math.abs(t.quantity)} units
                          </Typography>
                        </Box>
                      );
                    })}
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Right column */}
        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>Customer</Typography>
              <Detail label="Name" value={order.customerName} />
              <Detail label="Phone" value={order.customerPhone} />
              <Detail label="Email" value={order.customerEmail ?? "—"} />
              {order.deliveryType === "DELIVERY" && (
                <Detail
                  label="Delivery address"
                  value={
                    [order.addressLine1, order.addressLine2, order.city, order.state, order.postalCode]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
              )}
              {/* Instructions the customer left at checkout — the person
                  packing or delivering needs to see these. */}
              {order.deliveryNotes && (
                <Detail label="Delivery instructions" value={order.deliveryNotes} />
              )}
              {order.notes && <Detail label="Notes" value={order.notes} />}
              <Button href={`/customers/${order.customerId}`} size="small" sx={{ mt: 1 }}>
                View customer profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h5">Payment</Typography>
                <StatusChip value={order.paymentStatus} kind="payment" />
              </Box>

              {order.payments.map((payment) => (
                <Box key={payment.id} sx={{ mb: 1.5 }}>
                  <Detail label="Payment ID" value={payment.paymentNumber} />
                  <Detail label="Method" value={humanise(payment.method)} />
                  <Detail label="Amount" value={formatMoney(payment.amount)} />
                  {payment.transactionId && (
                    <Detail label="Transaction ID" value={payment.transactionId} />
                  )}
                  {payment.paidAt && <Detail label="Paid at" value={formatDateTime(payment.paidAt)} />}
                </Box>
              ))}

              {order.paymentStatus !== "PAID" && can("payments:update") && !terminated && (
                <Button
                  variant="contained"
                  fullWidth
                  loading={savingPayment}
                  onClick={markPaid}
                  className="no-print"
                >
                  Mark as paid
                </Button>
              )}
            </CardContent>
          </Card>

          {can("orders:update") && allowed.length > 0 && (
            <Card className="no-print">
              <CardContent>
                <Typography variant="h5" sx={{ mb: 2 }}>Update status</Typography>
                <TextField
                  select
                  label="New status"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  sx={{ mb: 1.5 }}
                >
                  {allowed.map((s) => (
                    <MenuItem key={s} value={s}>{humanise(s)}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Note (optional)"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!nextStatus}
                  onClick={() => setConfirmOpen(true)}
                >
                  Update status
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>Order info</Typography>
              <Detail label="Channel" value={humanise(order.channel)} />
              <Detail label="Order type" value={humanise(order.orderType)} />
              <Detail label="Created by" value={order.createdBy?.name ?? "—"} />
              <Detail label="Placed at" value={formatDateTime(order.placedAt)} />
              {order.deliveredAt && <Detail label="Delivered" value={formatDateTime(order.deliveredAt)} />}
            </CardContent>
          </Card>
        </Box>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title="Update order status?"
        destructive={nextStatus === "CANCELLED" || nextStatus === "RETURNED"}
        confirmLabel="Update"
        message={
          nextStatus === "CANCELLED" || nextStatus === "RETURNED"
            ? `Marking this order ${humanise(nextStatus).toLowerCase()} will return all its stock to inventory. This cannot be undone.`
            : `Change the status of ${order.orderNumber} to ${humanise(nextStatus).toLowerCase()}?`
        }
        onConfirm={updateStatus}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography variant="caption" sx={{ display: "block" }}>{label}</Typography>
      <Typography sx={{ fontSize: 14 }}>{value}</Typography>
    </Box>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: number;
  muted?: boolean;
  tone?: "success";
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
      <Typography sx={{ fontSize: 13.5, color: muted ? "text.secondary" : "text.primary" }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: 13.5,
          fontWeight: 600,
          color: tone === "success" ? "success.main" : muted ? "text.secondary" : "text.primary",
        }}
      >
        {formatMoney(value)}
      </Typography>
    </Box>
  );
}
