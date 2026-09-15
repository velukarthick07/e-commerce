"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusChip } from "@/components/common/StatusChip";
import { useOne, useList } from "@/hooks/useApiResource";
import { formatDate, formatDateTime, formatMoney, humanise, initials } from "@/lib/format";
import type { CustomerDto, OrderListDto } from "@/types/models";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: customer, loading, error } = useOne<CustomerDto>(`/customers/${id}`);
  const { items: orders, loading: ordersLoading } = useList<OrderListDto>(
    `/customers/${id}/orders`,
    { limit: 25 }
  );

  if (loading) {
    return (
      <>
        <PageHeader title="Customer" />
        <Skeleton variant="rounded" height={420} />
      </>
    );
  }

  if (error || !customer) {
    return (
      <>
        <PageHeader title="Customer" breadcrumbs={[{ label: "Customers", href: "/customers" }]} />
        <Alert severity="error">{error ?? "This customer could not be found."}</Alert>
      </>
    );
  }

  const averageOrder =
    customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0;

  const columns: Column<OrderListDto>[] = [
    {
      key: "orderNumber",
      label: "Order",
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{row.orderNumber}</Typography>
          <Typography variant="caption">{humanise(row.orderType)}</Typography>
        </Box>
      ),
    },
    { key: "items", label: "Items", align: "center", render: (row) => row._count?.items ?? "—" },
    {
      key: "grandTotal",
      label: "Amount",
      align: "right",
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{formatMoney(row.grandTotal)}</Typography>
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
      render: (row) => <Typography variant="caption">{formatDateTime(row.placedAt)}</Typography>,
    },
  ];

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={`Customer since ${formatDate(customer.createdAt)}`}
        breadcrumbs={[
          { label: "Customers", href: "/customers" },
          { label: customer.name },
        ]}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        <StatCard label="Total orders" value={customer.totalOrders} icon={<ShoppingBagOutlinedIcon />} />
        <StatCard
          label="Total spent"
          value={formatMoney(customer.totalSpent)}
          icon={<PaymentsOutlinedIcon />}
          accent="success"
        />
        <StatCard
          label="Average order"
          value={formatMoney(averageOrder)}
          icon={<TrendingUpOutlinedIcon />}
          accent="info"
        />
        <StatCard
          label="Last order"
          value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
          icon={<EventOutlinedIcon />}
          accent="warning"
        />
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "320px 1fr" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
                <Avatar sx={{ width: 52, height: 52, bgcolor: "primary.main", fontSize: 18 }}>
                  {initials(customer.name)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 600 }} noWrap>{customer.name}</Typography>
                  <Chip
                    size="small"
                    label={customer.isActive ? "Active" : "Inactive"}
                    variant={customer.isActive ? "filled" : "outlined"}
                    sx={customer.isActive ? { bgcolor: "#12B76A1A", color: "success.main" } : undefined}
                  />
                </Box>
              </Box>

              <Field label="Phone" value={customer.phone} />
              <Field label="Email" value={customer.email ?? "—"} />
              {customer.notes && <Field label="Notes" value={customer.notes} />}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Addresses ({customer.addresses.length})
              </Typography>
              {customer.addresses.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No address on file.
                </Typography>
              ) : (
                customer.addresses.map((address) => (
                  <Box
                    key={address.id}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      border: 1,
                      borderColor: address.isDefault ? "primary.main" : "divider",
                      bgcolor: address.isDefault ? "primary.light" : "transparent",
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{address.label}</Typography>
                      {address.isDefault && <Chip size="small" label="Default" sx={{ bgcolor: "#fff" }} />}
                    </Box>
                    <Typography sx={{ fontSize: 13.5 }}>
                      {[address.line1, address.line2, address.city, address.state, address.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Box>

        <Box>
          <Typography variant="h3" sx={{ fontSize: 18, mb: 1.5 }}>
            Order history
          </Typography>
          <DataTable
            columns={columns}
            rows={orders}
            rowKey={(row) => row.id}
            loading={ordersLoading}
            emptyTitle="No orders yet"
            emptyDescription="This customer has not placed an order."
            onRowClick={(row) => router.push(`/orders/${row.id}`)}
            mobileTitle={(row) => row.orderNumber}
          />
        </Box>
      </Box>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography variant="caption" sx={{ display: "block" }}>{label}</Typography>
      <Typography sx={{ fontSize: 14 }}>{value}</Typography>
    </Box>
  );
}
