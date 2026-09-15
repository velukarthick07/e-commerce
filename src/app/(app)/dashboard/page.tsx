"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import AddIcon from "@mui/icons-material/Add";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { EmptyState } from "@/components/common/EmptyState";
import { useOne } from "@/hooks/useApiResource";
import { useAuth } from "@/context/AuthContext";
import { brand, chartColors } from "@/theme/palette";
import {
  daysUntil,
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatNumber,
  humanise,
} from "@/lib/format";
import type { DashboardDto } from "@/types/models";

type Range = "daily" | "weekly" | "monthly";

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [range, setRange] = useState<Range>("daily");
  const { data, loading, error } = useOne<DashboardDto>("/reports/dashboard", {
    salesRange: range,
  });

  const cards = data?.cards;

  const salesSeries = (data?.salesSeries ?? []).map((point) => ({
    label:
      range === "monthly"
        ? new Date(point.bucket).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
        : new Date(point.bucket).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    revenue: point.revenue,
    orders: point.orders,
  }));

  // Online vs local, split by lifecycle state (spec §10)
  const overview = (() => {
    const rows = data?.ordersOverview ?? [];
    const group = (status: string) =>
      rows.filter((r) => {
        if (status === "completed") return r.status === "DELIVERED";
        if (status === "cancelled") return r.status === "CANCELLED" || r.status === "RETURNED";
        return !["DELIVERED", "CANCELLED", "RETURNED"].includes(r.status);
      });

    return [
      { name: "Pending", Online: 0, Local: 0, key: "pending" },
      { name: "Completed", Online: 0, Local: 0, key: "completed" },
      { name: "Cancelled", Online: 0, Local: 0, key: "cancelled" },
    ].map((bucket) => {
      const matching = group(bucket.key);
      return {
        name: bucket.name,
        Online: matching.filter((r) => r.channel === "ONLINE").reduce((s, r) => s + r.count, 0),
        Local: matching.filter((r) => r.channel === "LOCAL").reduce((s, r) => s + r.count, 0),
      };
    });
  })();

  const statusData = (data?.statusBreakdown ?? []).map((s) => ({
    name: humanise(s.status),
    value: s.count,
  }));

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Alert severity="error">{error}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${user?.name?.split(" ")[0] ?? ""}`}
        subtitle="Here is how the store is performing today."
        actions={
          can("local-orders:create") ? (
            <Button
              component={Link}
              href="/local-orders/new"
              variant="contained"
              startIcon={<AddIcon />}
            >
              New Local Order
            </Button>
          ) : null
        }
      />

      {/* Summary cards */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          mb: 3,
        }}
      >
        <StatCard
          label="Today's Sales"
          value={formatMoney(cards?.todaySales)}
          change={cards?.todaySalesChange}
          comparison="vs yesterday"
          icon={<PaymentsOutlinedIcon />}
          loading={loading}
        />
        <StatCard
          label="Total Sales"
          value={formatMoneyShort(cards?.totalSales)}
          comparison="all time"
          icon={<TrendingUpOutlinedIcon />}
          accent="success"
          loading={loading}
        />
        <StatCard
          label="Total Orders"
          value={formatNumber(cards?.totalOrders)}
          change={cards?.todayOrdersChange}
          comparison={`${formatNumber(cards?.todayOrders)} today`}
          icon={<ShoppingBagOutlinedIcon />}
          accent="info"
          loading={loading}
        />
        <StatCard
          label="Local Orders"
          value={formatNumber(cards?.localOrders)}
          comparison={`${formatNumber(cards?.onlineOrders)} online`}
          icon={<PointOfSaleOutlinedIcon />}
          loading={loading}
        />
        <StatCard
          label="Pending Orders"
          value={formatNumber(cards?.pendingOrders)}
          comparison="awaiting confirmation"
          icon={<PendingActionsOutlinedIcon />}
          accent="warning"
          loading={loading}
        />
        <StatCard
          label="Completed Orders"
          value={formatNumber(cards?.completedOrders)}
          comparison="delivered"
          icon={<TaskAltOutlinedIcon />}
          accent="success"
          loading={loading}
        />
        <StatCard
          label="Total Customers"
          value={formatNumber(cards?.totalCustomers)}
          comparison={`${formatNumber(cards?.newCustomersToday)} new today`}
          icon={<PeopleAltOutlinedIcon />}
          accent="info"
          loading={loading}
        />
        <StatCard
          label="Total Products"
          value={formatNumber(cards?.totalProducts)}
          comparison={`${formatNumber(cards?.activeProducts)} active`}
          icon={<Inventory2OutlinedIcon />}
          loading={loading}
        />
      </Box>

      {/* Sales + status */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1.7fr 1fr" },
          mb: 2,
        }}
      >
        <ChartCard
          title="Sales Overview"
          subtitle="Revenue and order volume"
          loading={loading}
          isEmpty={salesSeries.length === 0}
          action={
            <ToggleButtonGroup
              size="small"
              exclusive
              value={range}
              onChange={(_, value: Range | null) => value && setRange(value)}
              aria-label="Sales period"
            >
              <ToggleButton value="daily">Daily</ToggleButton>
              <ToggleButton value="weekly">Weekly</ToggleButton>
              <ToggleButton value="monthly">Monthly</ToggleButton>
            </ToggleButtonGroup>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesSeries} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brand.primary} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={brand.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: brand.textSecondary }}
                tickLine={false}
                axisLine={{ stroke: brand.border }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: brand.textSecondary }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatMoneyShort(v)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(value, key) =>
                      key === "revenue" ? formatMoney(value) : formatNumber(value)
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={brand.primary}
                strokeWidth={2.5}
                fill="url(#salesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Order Status"
          subtitle="Across all orders"
          loading={loading}
          isEmpty={statusData.length === 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={94}
                paddingAngle={2}
                stroke="none"
              >
                {statusData.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip formatter={(v) => `${formatNumber(v)} orders`} />} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value: string) => (
                  <span style={{ fontSize: 12.5, color: brand.textSecondary }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Box>

      {/* Orders overview + top products */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          mb: 2,
        }}
      >
        <ChartCard
          title="Orders Overview"
          subtitle="Online vs local orders by state"
          loading={loading}
          isEmpty={overview.every((o) => o.Online === 0 && o.Local === 0)}
          height={280}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={overview} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: brand.textSecondary }}
                tickLine={false}
                axisLine={{ stroke: brand.border }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: brand.textSecondary }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(127,86,217,.06)" }} />
              <Legend
                iconType="circle"
                formatter={(value: string) => (
                  <span style={{ fontSize: 12.5, color: brand.textSecondary }}>{value}</span>
                )}
              />
              <Bar dataKey="Local" fill={brand.primary} radius={[6, 6, 0, 0]} maxBarSize={44} />
              <Bar dataKey="Online" fill={brand.info} radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="h5">Top Products</Typography>
                <Typography variant="caption">Last 30 days by units sold</Typography>
              </Box>
              <Button component={Link} href="/reports?tab=products" size="small">
                View report
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: "grid", gap: 1.5 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={44} />
                ))}
              </Box>
            ) : (data?.topProducts.length ?? 0) === 0 ? (
              <EmptyState compact title="No sales yet" description="Top sellers appear here once orders come in." />
            ) : (
              <Box>
                {data!.topProducts.map((product, index) => (
                  <Box key={product.productId}>
                    {index > 0 && <Divider />}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: 1.5,
                          bgcolor: "primary.light",
                          color: "primary.main",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                          {product.name}
                        </Typography>
                        <Typography variant="caption">{product.sku}</Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                          {formatMoney(product.revenue)}
                        </Typography>
                        <Typography variant="caption">{product.units} units</Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Operational watchlists */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <WarningAmberOutlinedIcon sx={{ color: "warning.main", fontSize: 20 }} />
                <Typography variant="h5">Low Stock</Typography>
              </Box>
              <Button component={Link} href="/inventory?stockStatus=low_stock" size="small">
                View all
              </Button>
            </Box>

            {loading ? (
              <Skeleton height={160} />
            ) : (data?.lowStock.length ?? 0) === 0 ? (
              <EmptyState
                compact
                title="Stock levels look healthy"
                description="Nothing is below its minimum threshold."
                icon={<TaskAltOutlinedIcon />}
              />
            ) : (
              data!.lowStock.map((row, index) => (
                <Box key={row.id}>
                  {index > 0 && <Divider />}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                        {row.product.name}
                      </Typography>
                      <Typography variant="caption">
                        {row.variant.name} · {row.variant.sku}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: row.currentStock <= 0 ? "error.main" : "warning.main",
                        flexShrink: 0,
                      }}
                    >
                      {row.currentStock} / {row.minStock} {row.product.unit}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <EventBusyOutlinedIcon sx={{ color: "error.main", fontSize: 20 }} />
                <Typography variant="h5">Expiring Soon</Typography>
              </Box>
              <Button component={Link} href="/inventory/expiry" size="small">
                View all
              </Button>
            </Box>

            {loading ? (
              <Skeleton height={160} />
            ) : (data?.expiring.length ?? 0) === 0 ? (
              <EmptyState
                compact
                title="No batches expiring"
                description="Nothing expires within the next 30 days."
                icon={<TaskAltOutlinedIcon />}
              />
            ) : (
              data!.expiring.map((batch, index) => {
                const days = daysUntil(batch.expiryDate);
                const expired = days !== null && days < 0;
                return (
                  <Box key={batch.id}>
                    {index > 0 && <Divider />}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.25 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                          {batch.product.name}
                        </Typography>
                        <Typography variant="caption">
                          {batch.variant.name} · Batch {batch.batchNumber} ·{" "}
                          {batch.remainingQuantity} {batch.product.unit}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: expired ? "error.main" : days! <= 7 ? "warning.main" : "text.primary",
                          }}
                        >
                          {expired ? "Expired" : `${days} days`}
                        </Typography>
                        <Typography variant="caption">{formatDate(batch.expiryDate)}</Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
