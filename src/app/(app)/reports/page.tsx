"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { ChartCard } from "@/components/charts/ChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { EmptyState } from "@/components/common/EmptyState";
import { downloadCsv, getOne, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";
import { brand, chartColors } from "@/theme/palette";
import { formatMoney, formatMoneyShort, formatNumber, humanise } from "@/lib/format";

const TABS = [
  { key: "sales", label: "Sales" },
  { key: "orders", label: "Orders" },
  { key: "products", label: "Products" },
  { key: "customers", label: "Customers" },
  { key: "inventory", label: "Inventory" },
  { key: "payments", label: "Payments" },
  { key: "local-orders", label: "Local Orders" },
];

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = any;

function ReportsContent() {
  const params = useSearchParams();
  const toast = useToast();

  const initialTab = Math.max(0, TABS.findIndex((t) => t.key === params.get("tab")));
  const [tab, setTab] = useState(initialTab === -1 ? 0 : initialTab);
  const [preset, setPreset] = useState("last_30_days");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [exporting, setExporting] = useState(false);

  const report = TABS[tab].key;
  const needsDates = preset === "custom";
  const ready = !needsDates || (!!from && !!to);

  // Results carry the request they belong to, so `loading` is derived rather
  // than set synchronously inside the effect.
  const requestKey = `${report}|${preset}|${groupBy}|${from}|${to}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: ReportData;
    error: string | null;
  } | null>(null);

  const loading = ready && snapshot?.key !== requestKey;
  const data = snapshot?.key === requestKey ? snapshot.data : null;
  const error = snapshot?.key === requestKey ? snapshot.error : null;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = await getOne<ReportData>(`/reports/${report}`, {
          preset,
          groupBy,
          from: from || undefined,
          to: to || undefined,
        });
        if (!cancelled) setSnapshot({ key: requestKey, data: result, error: null });
      } catch (err) {
        if (!cancelled) {
          setSnapshot({
            key: requestKey,
            data: null,
            error: err instanceof ApiError ? err.message : "Unable to load report",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [report, preset, groupBy, from, to, ready, requestKey]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv(
        `/reports/${report}`,
        { preset, groupBy, from: from || undefined, to: to || undefined },
        `${report}-report-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast.success("Export downloaded");
    } catch {
      toast.error("Unable to export this report");
    } finally {
      setExporting(false);
    }
  };

  const series = (data?.byPeriod ?? []).map((row: ReportData) => ({
    label: new Date(row.bucket).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      ...(groupBy === "month" ? { year: "2-digit", day: undefined } : {}),
    }),
    netSales: row.netSales,
    grossSales: row.grossSales,
    orders: row.orders,
    discounts: row.discounts,
    tax: row.tax,
  }));

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Live figures straight from the database"
        actions={
          report !== "inventory" || true ? (
            <Button
              variant="outlined"
              startIcon={<DownloadOutlinedIcon />}
              loading={exporting}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          ) : null
        }
      />

      <Card sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t) => (
            <Tab key={t.key} label={t.label} />
          ))}
        </Tabs>
      </Card>

      {report !== "inventory" && (
        <FilterBar>
          <TextField
            select
            size="small"
            label="Period"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            sx={{ minWidth: 170 }}
          >
            {PRESETS.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>

          {needsDates && (
            <>
              <TextField
                type="date"
                size="small"
                label="From"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                type="date"
                size="small"
                label="To"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 160 }}
              />
            </>
          )}

          <TextField
            select
            size="small"
            label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "day" | "week" | "month")}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="day">Day</MenuItem>
            <MenuItem value="week">Week</MenuItem>
            <MenuItem value="month">Month</MenuItem>
          </TextField>
        </FilterBar>
      )}

      {!ready && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Choose a start and end date to run this report.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary cards */}
      {data?.summary && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            mb: 3,
          }}
        >
          <StatCard label="Gross sales" value={formatMoney(data.summary.grossSales)} icon={<span>₹</span>} loading={loading} />
          <StatCard label="Discounts" value={formatMoney(data.summary.discounts)} icon={<span>%</span>} accent="warning" loading={loading} />
          <StatCard label="Net sales" value={formatMoney(data.summary.netSales)} icon={<span>=</span>} accent="success" loading={loading} />
          <StatCard
            label="Orders"
            value={formatNumber(data.summary.orders)}
            comparison={`avg ${formatMoney(data.summary.averageOrderValue)}`}
            icon={<span>#</span>}
            accent="info"
            loading={loading}
          />
        </Box>
      )}

      {report === "inventory" && data && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            mb: 3,
          }}
        >
          <StatCard label="Tracked SKUs" value={formatNumber(data.counts.total)} icon={<span>#</span>} loading={loading} />
          <StatCard label="Units on hand" value={formatNumber(data.valuation.totalUnits)} icon={<span>∑</span>} accent="info" loading={loading} />
          <StatCard label="Retail value" value={formatMoneyShort(data.valuation.retailValue)} icon={<span>₹</span>} accent="success" loading={loading} />
          <StatCard label="Low / out of stock" value={`${data.counts.lowStock} / ${data.counts.outOfStock}`} icon={<span>!</span>} accent="warning" loading={loading} />
        </Box>
      )}

      {/* Charts */}
      {["sales", "orders", "local-orders"].includes(report) && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, mb: 2 }}>
          <ChartCard
            title="Sales trend"
            subtitle={`Net sales grouped by ${groupBy}`}
            loading={loading}
            isEmpty={series.length === 0}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={series} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: brand.textSecondary }} tickLine={false} axisLine={{ stroke: brand.border }} />
                <YAxis tick={{ fontSize: 12, fill: brand.textSecondary }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatMoneyShort(v)} />
                <RechartsTooltip content={<ChartTooltip formatter={(v, k) => (k === "orders" ? formatNumber(v) : formatMoney(v))} />} />
                <Legend iconType="circle" formatter={(value: string) => <span style={{ fontSize: 12.5, color: brand.textSecondary }}>{value}</span>} />
                <Line type="monotone" dataKey="netSales" name="Net sales" stroke={brand.primary} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="discounts" name="Discounts" stroke={brand.warning} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="By order type"
            loading={loading}
            isEmpty={(data?.byOrderType?.length ?? 0) === 0}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={(data?.byOrderType ?? []).map((row: ReportData) => ({
                    name: humanise(row.orderType),
                    value: row.revenue,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="none"
                >
                  {(data?.byOrderType ?? []).map((_: ReportData, index: number) => (
                    <Cell key={index} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<ChartTooltip formatter={(v) => formatMoney(v)} />} />
                <Legend verticalAlign="bottom" iconType="circle" formatter={(value: string) => <span style={{ fontSize: 12, color: brand.textSecondary }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Box>
      )}

      {report === "sales" && (data?.byCategory?.length ?? 0) > 0 && (
        <Box sx={{ mb: 2 }}>
          <ChartCard title="Revenue by category" loading={loading} isEmpty={false} height={280}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byCategory} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: brand.textSecondary }} tickLine={false} axisLine={{ stroke: brand.border }} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 12, fill: brand.textSecondary }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatMoneyShort(v)} />
                <RechartsTooltip content={<ChartTooltip formatter={(v) => formatMoney(v)} />} cursor={{ fill: "rgba(127,86,217,.06)" }} />
                <Bar dataKey="revenue" name="Revenue" fill={brand.primary} radius={[6, 6, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Box>
      )}

      {report === "customers" && (data?.newCustomers?.length ?? 0) > 0 && (
        <Box sx={{ mb: 2 }}>
          <ChartCard title="New customers" loading={loading} isEmpty={false} height={260}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.newCustomers.map((row: ReportData) => ({
                  label: new Date(row.bucket).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
                  count: row.count,
                }))}
                margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: brand.textSecondary }} tickLine={false} axisLine={{ stroke: brand.border }} />
                <YAxis tick={{ fontSize: 12, fill: brand.textSecondary }} tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "rgba(127,86,217,.06)" }} />
                <Bar dataKey="count" name="New customers" fill={brand.primary} radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Box>
      )}

      {/* Tables */}
      {loading ? (
        <Skeleton variant="rounded" height={320} />
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {(report === "sales" || report === "products" || report === "local-orders") &&
            (data?.topProducts?.length ?? 0) > 0 && (
              <ReportTable
                title="Top products"
                head={["Product", "SKU", "Units", "Revenue", "Avg price"]}
                rows={data.topProducts.map((row: ReportData) => [
                  row.name,
                  row.sku,
                  formatNumber(row.units),
                  formatMoney(row.revenue),
                  formatMoney(row.avgPrice),
                ])}
              />
            )}

          {report === "products" && (data?.lowPerforming?.length ?? 0) > 0 && (
            <ReportTable
              title="Low-performing products"
              subtitle="Fewest units sold in this period"
              head={["Product", "SKU", "Units", "Revenue"]}
              rows={data.lowPerforming.map((row: ReportData) => [
                row.name,
                row.sku,
                formatNumber(row.units),
                formatMoney(row.revenue),
              ])}
            />
          )}

          {report === "customers" && (data?.topCustomers?.length ?? 0) > 0 && (
            <ReportTable
              title="Top customers"
              head={["Customer", "Phone", "Orders", "Total spent"]}
              rows={data.topCustomers.map((row: ReportData) => [
                row.name,
                row.phone,
                formatNumber(row.orders),
                formatMoney(row.revenue),
              ])}
            />
          )}

          {report === "payments" && (data?.breakdown?.length ?? 0) > 0 && (
            <ReportTable
              title="Payments by method"
              head={["Method", "Status", "Count", "Amount"]}
              rows={data.breakdown.map((row: ReportData) => [
                humanise(row.method),
                humanise(row.status),
                formatNumber(row.count),
                formatMoney(row.amount),
              ])}
            />
          )}

          {report === "inventory" && (
            <>
              <ReportTable
                title="Expiry buckets"
                head={["Bucket", "Batches", "Units"]}
                rows={(data?.expiry ?? []).map((row: ReportData) => [
                  humanise(row.bucket === "7_days" ? "WITHIN_7_DAYS" : row.bucket === "30_days" ? "WITHIN_30_DAYS" : row.bucket === "60_days" ? "WITHIN_60_DAYS" : row.bucket),
                  formatNumber(row.batches),
                  formatNumber(row.units),
                ])}
              />
              <ReportTable
                title="Low stock items"
                head={["Product", "Variant", "SKU", "Current", "Minimum"]}
                rows={(data?.lowStock ?? []).map((row: ReportData) => [
                  row.product.name,
                  row.variant.name,
                  row.variant.sku,
                  formatNumber(row.currentStock),
                  formatNumber(row.minStock),
                ])}
              />
            </>
          )}

          {(report === "sales" || report === "orders" || report === "local-orders") &&
            (data?.byPeriod?.length ?? 0) > 0 && (
              <ReportTable
                title={`Breakdown by ${groupBy}`}
                head={["Period", "Orders", "Gross", "Discounts", "Tax", "Net"]}
                rows={data.byPeriod.map((row: ReportData) => [
                  new Date(row.bucket).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
                  formatNumber(row.orders),
                  formatMoney(row.grossSales),
                  formatMoney(row.discounts),
                  formatMoney(row.tax),
                  formatMoney(row.netSales),
                ])}
              />
            )}

          {data && !loading && isEmptyReport(report, data) && (
            <Card>
              <EmptyState
                title="No data for this period"
                description="Try widening the date range or choosing a different report."
              />
            </Card>
          )}
        </Box>
      )}
    </>
  );
}

function isEmptyReport(report: string, data: ReportData): boolean {
  if (report === "inventory") return (data.counts?.total ?? 0) === 0;
  if (report === "customers") return (data.topCustomers?.length ?? 0) === 0;
  if (report === "payments") return (data.breakdown?.length ?? 0) === 0;
  if (report === "products") return (data.topProducts?.length ?? 0) === 0;
  return (data.byPeriod?.length ?? 0) === 0;
}

function ReportTable({
  title,
  subtitle,
  head,
  rows,
}: {
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <Card>
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <Typography variant="h5">{title}</Typography>
          {subtitle && <Typography variant="caption">{subtitle}</Typography>}
        </Box>
        <Box sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                {head.map((cell, index) => (
                  <TableCell key={cell} align={index === 0 ? "left" : "right"}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      align={cellIndex === 0 ? "left" : "right"}
                      sx={cellIndex === 0 ? { fontWeight: 500 } : undefined}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={400} />}>
      <ReportsContent />
    </Suspense>
  );
}
