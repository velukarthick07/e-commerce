"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { StatusChip } from "@/components/common/StatusChip";
import { useList } from "@/hooks/useApiResource";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDateTime, formatMoney, humanise } from "@/lib/format";
import type { OrderListDto } from "@/types/models";

const ORDER_STATUSES = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED",
];

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];

const ORDER_TYPES = [
  "LOCAL_DELIVERY", "STORE_PICKUP", "WALK_IN",
  "PHONE_ORDER", "WHATSAPP_ORDER", "ONLINE_ORDER",
];

/**
 * Shared by /orders, /local-orders and /online-orders. The last two hide the
 * channel filter and pin it instead — /local-orders through a dedicated
 * endpoint, /online-orders through `defaultChannel`.
 */
export function OrdersView({
  endpoint = "/orders",
  showChannelFilter = true,
  defaultChannel = "all",
  emptyTitle = "No orders found",
  emptyDescription = "Try changing your filters, or create a new order.",
  emptyAction,
}: {
  endpoint?: string;
  showChannelFilter?: boolean;
  defaultChannel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [orderType, setOrderType] = useState("all");
  const [channel, setChannel] = useState(defaultChannel);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState("placedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const debouncedSearch = useDebounce(search, 350);

  const { items, meta, loading, error } = useList<OrderListDto>(endpoint, {
    search: debouncedSearch,
    status,
    paymentStatus,
    orderType,
    channel: showChannelFilter
      ? channel
      : defaultChannel === "all"
        ? undefined
        : defaultChannel,
    from: from || undefined,
    to: to || undefined,
    page,
    limit,
    sortBy,
    sortOrder,
  });

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const columns: Column<OrderListDto>[] = [
    {
      key: "orderNumber",
      label: "Order ID",
      sortable: true,
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{row.orderNumber}</Typography>
          <Typography variant="caption">{humanise(row.orderType)}</Typography>
        </Box>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14 }} noWrap>{row.customerName}</Typography>
          <Typography variant="caption">{row.customerPhone}</Typography>
        </Box>
      ),
    },
    {
      key: "items",
      label: "Items",
      align: "center",
      render: (row) => row._count?.items ?? "—",
    },
    {
      key: "grandTotal",
      label: "Amount",
      align: "right",
      sortable: true,
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          {formatMoney(row.grandTotal)}
        </Typography>
      ),
    },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (row) => <StatusChip value={row.paymentStatus} kind="payment" />,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusChip value={row.status} kind="order" />,
    },
    {
      key: "placedAt",
      label: "Date",
      sortable: true,
      render: (row) => (
        <Typography variant="caption">{formatDateTime(row.placedAt)}</Typography>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <Button
          size="small"
          startIcon={<VisibilityOutlinedIcon />}
          onClick={() => router.push(`/orders/${row.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <FilterBar>
        <SearchField
          value={search}
          onChange={resetPage(setSearch)}
          placeholder="Order ID, customer or phone"
        />

        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All statuses</MenuItem>
          {ORDER_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>{humanise(s)}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Payment"
          value={paymentStatus}
          onChange={(e) => resetPage(setPaymentStatus)(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All payments</MenuItem>
          {PAYMENT_STATUSES.map((s) => (
            <MenuItem key={s} value={s}>{humanise(s)}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Order type"
          value={orderType}
          onChange={(e) => resetPage(setOrderType)(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All types</MenuItem>
          {ORDER_TYPES.map((t) => (
            <MenuItem key={t} value={t}>{humanise(t)}</MenuItem>
          ))}
        </TextField>

        {showChannelFilter && (
          <TextField
            select
            size="small"
            label="Channel"
            value={channel}
            onChange={(e) => resetPage(setChannel)(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">All channels</MenuItem>
            <MenuItem value="LOCAL">Local</MenuItem>
            <MenuItem value="ONLINE">Online</MenuItem>
          </TextField>
        )}

        <TextField
          type="date"
          size="small"
          label="From"
          value={from}
          onChange={(e) => resetPage(setFrom)(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={to}
          onChange={(e) => resetPage(setTo)(e.target.value)}
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
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        page={page}
        limit={limit}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(key, order) => {
          setSortBy(key);
          setSortOrder(order);
        }}
        onRowClick={(row) => router.push(`/orders/${row.id}`)}
        mobileTitle={(row) => row.orderNumber}
      />
    </>
  );
}
