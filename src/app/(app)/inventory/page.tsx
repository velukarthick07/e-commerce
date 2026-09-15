"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
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
import { getList, getOne, post, ApiError } from "@/services/api/client";
import { formatDate, formatNumber } from "@/lib/format";
import type { CategoryDto, InventoryRowDto } from "@/types/models";

const ADJUST_TYPES = [
  { value: "STOCK_ADDED", label: "Stock added" },
  { value: "STOCK_REMOVED", label: "Stock removed" },
  { value: "MANUAL_ADJUSTMENT", label: "Manual adjustment" },
  { value: "RETURN", label: "Customer return" },
  { value: "EXPIRED_STOCK", label: "Expired stock write-off" },
];

export default function InventoryPage() {
  const { can } = useAuth();
  const toast = useToast();

  // Deep links from the dashboard (?stockStatus=low_stock&search=…) seed the
  // initial filter state directly — no effect, no cascading render.
  const [search, setSearch] = useState(
    () => new URLSearchParams(window.location.search).get("search") ?? ""
  );
  const [categoryId, setCategoryId] = useState("all");
  const [stockStatus, setStockStatus] = useState(
    () => new URLSearchParams(window.location.search).get("stockStatus") ?? "all"
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState("currentStock");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [summary, setSummary] = useState<{ total: number; inStock: number; lowStock: number; outOfStock: number } | null>(null);

  const [adjusting, setAdjusting] = useState<InventoryRowDto | null>(null);
  const [adjustType, setAdjustType] = useState("STOCK_ADDED");
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    void getList<CategoryDto>("/categories/tree")
      .then(({ data }) => setCategories(data))
      .catch(() => undefined);
  }, []);

  const { items, meta, loading, error, reload } = useList<InventoryRowDto>("/inventory", {
    search: debouncedSearch,
    categoryId,
    stockStatus,
    page,
    limit,
    sortBy,
    sortOrder,
  });

  const loadSummary = useCallback(
    () =>
      getOne<{ total: number; inStock: number; lowStock: number; outOfStock: number }>(
        "/inventory/summary"
      )
        .then(setSummary)
        .catch(() => undefined),
    []
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getOne<{
          total: number;
          inStock: number;
          lowStock: number;
          outOfStock: number;
        }>("/inventory/summary");
        if (!cancelled) setSummary(result);
      } catch {
        /* the cards simply stay in their loading state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitAdjustment = async () => {
    if (!adjusting) return;
    setSaving(true);
    try {
      const result = await post("/inventory/adjust", {
        variantId: adjusting.variant.id,
        type: adjustType,
        quantity: Number(adjustQty),
        note: adjustNote,
      });
      toast.success(result.message);
      setAdjusting(null);
      setAdjustQty("1");
      setAdjustNote("");
      await Promise.all([reload(), loadSummary()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<InventoryRowDto>[] = [
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>{row.product.name}</Typography>
          <Typography variant="caption">
            {row.variant.name} · {row.variant.sku}
          </Typography>
        </Box>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row) => row.product.category?.name ?? "—",
    },
    {
      key: "currentStock",
      label: "Current",
      align: "center",
      sortable: true,
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          {formatNumber(row.currentStock)}
        </Typography>
      ),
    },
    { key: "reservedStock", label: "Reserved", align: "center" },
    {
      key: "available",
      label: "Available",
      align: "center",
      render: (row) => formatNumber(row.currentStock - row.reservedStock),
    },
    { key: "minStock", label: "Min", align: "center" },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const status =
          row.currentStock <= 0
            ? "out_of_stock"
            : row.currentStock <= row.minStock
              ? "low_stock"
              : "in_stock";
        return <StatusChip value={status} kind="stock" />;
      },
    },
    {
      key: "lastRestockedAt",
      label: "Last restocked",
      render: (row) => <Typography variant="caption">{formatDate(row.lastRestockedAt)}</Typography>,
    },
    ...(can("inventory:update")
      ? [
          {
            key: "actions",
            label: "",
            align: "right" as const,
            render: (row: InventoryRowDto) => (
              <Button size="small" startIcon={<TuneOutlinedIcon />} onClick={() => setAdjusting(row)}>
                Adjust
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Live stock levels for every product variant"
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        <StatCard label="Tracked SKUs" value={formatNumber(summary?.total)} icon={<Inventory2OutlinedIcon />} loading={!summary} />
        <StatCard label="In stock" value={formatNumber(summary?.inStock)} icon={<CheckCircleOutlinedIcon />} accent="success" loading={!summary} />
        <StatCard label="Low stock" value={formatNumber(summary?.lowStock)} icon={<WarningAmberOutlinedIcon />} accent="warning" loading={!summary} />
        <StatCard label="Out of stock" value={formatNumber(summary?.outOfStock)} icon={<ErrorOutlineIcon />} accent="error" loading={!summary} />
      </Box>

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Product, SKU or barcode"
        />
        <TextField
          select
          size="small"
          label="Category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All categories</MenuItem>
          {categories.map((parent) => [
            <MenuItem key={parent.id} value={String(parent.id)} sx={{ fontWeight: 600 }}>
              {parent.name}
            </MenuItem>,
            ...(parent.children ?? []).map((child) => (
              <MenuItem key={child.id} value={String(child.id)} sx={{ pl: 3.5 }}>
                {child.name}
              </MenuItem>
            )),
          ])}
        </TextField>
        <TextField
          select
          size="small"
          label="Stock status"
          value={stockStatus}
          onChange={(e) => {
            setStockStatus(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="in_stock">In stock</MenuItem>
          <MenuItem value="low_stock">Low stock</MenuItem>
          <MenuItem value="out_of_stock">Out of stock</MenuItem>
        </TextField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => String(row.id)}
        loading={loading}
        error={error}
        emptyTitle="No inventory records found"
        emptyDescription="Try changing your filters."
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
        mobileTitle={(row) => `${row.product.name} · ${row.variant.name}`}
      />

      <Dialog open={!!adjusting} onClose={() => setAdjusting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogContent>
          {adjusting && (
            <Box sx={{ display: "grid", gap: 2, pt: 0.5 }}>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                  {adjusting.product.name}
                </Typography>
                <Typography variant="caption">
                  {adjusting.variant.name} · current stock {adjusting.currentStock}
                </Typography>
              </Box>
              <TextField
                select
                label="Reason"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
              >
                {ADJUST_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Quantity"
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                helperText="Removals consume the earliest-expiring batch first"
              />
              <TextField
                label="Note (optional)"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjusting(null)} color="inherit">Cancel</Button>
          <Button variant="contained" loading={saving} onClick={submitAdjustment}>
            Apply adjustment
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
