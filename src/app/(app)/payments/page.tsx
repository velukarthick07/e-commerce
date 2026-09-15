"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { StatusChip } from "@/components/common/StatusChip";
import { useList } from "@/hooks/useApiResource";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { patch, ApiError } from "@/services/api/client";
import { formatDateTime, formatMoney, humanise } from "@/lib/format";
import type { PaymentDto } from "@/types/models";

const STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const METHODS = ["CASH", "CARD", "UPI", "ONLINE_PAYMENT", "COD"];

export default function PaymentsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [editing, setEditing] = useState<PaymentDto | null>(null);
  const [newStatus, setNewStatus] = useState("PAID");
  const [transactionId, setTransactionId] = useState("");
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const { items, meta, loading, error, reload } = useList<PaymentDto>("/payments", {
    search: debouncedSearch,
    status,
    method,
    from: from || undefined,
    to: to || undefined,
    page,
    limit,
  });

  const collected = (meta?.collected as number | undefined) ?? 0;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const result = await patch(`/payments/${editing.id}`, {
        status: newStatus,
        transactionId,
      });
      toast.success(result.message);
      setEditing(null);
      setTransactionId("");
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update the payment");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<PaymentDto>[] = [
    {
      key: "paymentNumber",
      label: "Payment ID",
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{row.paymentNumber}</Typography>
      ),
    },
    {
      key: "order",
      label: "Order",
      render: (row) => row.order?.orderNumber ?? "—",
    },
    {
      key: "customer",
      label: "Customer",
      render: (row) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14 }} noWrap>{row.customer?.name ?? "—"}</Typography>
          <Typography variant="caption">{row.customer?.phone ?? ""}</Typography>
        </Box>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{formatMoney(row.amount)}</Typography>
      ),
    },
    { key: "method", label: "Method", render: (row) => humanise(row.method) },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusChip value={row.status} kind="payment" />,
    },
    {
      key: "transactionId",
      label: "Transaction ID",
      render: (row) => (
        <Typography variant="caption">{row.transactionId || "—"}</Typography>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (row) => <Typography variant="caption">{formatDateTime(row.createdAt)}</Typography>,
    },
    ...(can("payments:update")
      ? [
          {
            key: "actions",
            label: "",
            align: "right" as const,
            render: (row: PaymentDto) => (
              <Button
                size="small"
                onClick={() => {
                  setEditing(row);
                  setNewStatus(row.status === "PAID" ? "REFUNDED" : "PAID");
                  setTransactionId(row.transactionId ?? "");
                }}
              >
                Update
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment recorded against an order" />

      <Box sx={{ mb: 3, maxWidth: 320 }}>
        <StatCard
          label="Collected (current filter)"
          value={formatMoney(collected)}
          icon={<PaymentsOutlinedIcon />}
          accent="success"
          loading={loading}
        />
      </Box>

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Payment ID, order, customer or txn"
        />
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All statuses</MenuItem>
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>{humanise(s)}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Method"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All methods</MenuItem>
          {METHODS.map((m) => (
            <MenuItem key={m} value={m}>{humanise(m)}</MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label="From"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        emptyTitle="No payments found"
        emptyDescription="Try changing your filters."
        page={page}
        limit={limit}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        onRowClick={(row) => row.order && router.push(`/orders/${row.order.id}`)}
        mobileTitle={(row) => row.paymentNumber}
      />

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Update payment</DialogTitle>
        <DialogContent>
          {editing && (
            <Box sx={{ display: "grid", gap: 2, pt: 0.5 }}>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{editing.paymentNumber}</Typography>
                <Typography variant="caption">
                  {formatMoney(editing.amount)} · {humanise(editing.method)}
                </Typography>
              </Box>
              <TextField
                select
                label="Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{humanise(s)}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} color="inherit">Cancel</Button>
          <Button variant="contained" loading={saving} onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
