"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { StatusChip } from "@/components/common/StatusChip";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useList } from "@/hooks/useApiResource";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getList, post, put, del, ApiError } from "@/services/api/client";
import { formatDate, formatMoney, daysUntil } from "@/lib/format";
import type { BatchDto, SearchProductDto, VariantDto } from "@/types/models";

interface VariantOption {
  variantId: string;
  label: string;
  sku: string;
}

function bucketOf(expiryDate: string | null): string {
  const days = daysUntil(expiryDate);
  if (days === null) return "normal";
  if (days < 0) return "expired";
  if (days <= 7) return "7_days";
  if (days <= 30) return "30_days";
  if (days <= 60) return "60_days";
  return "normal";
}

const EMPTY_FORM = {
  variantId: "",
  batchNumber: "",
  manufacturingDate: "",
  expiryDate: "",
  bestBeforeDate: "",
  quantity: "1",
  purchasePrice: "",
  mrp: "",
  sellingPrice: "",
  receivedDate: new Date().toISOString().slice(0, 10),
};

export default function BatchesPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BatchDto | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BatchDto | null>(null);

  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantQuery, setVariantQuery] = useState("");
  const debouncedVariantQuery = useDebounce(variantQuery, 300);
  const debouncedSearch = useDebounce(search, 350);

  const { items, meta, loading, error, reload } = useList<BatchDto>("/inventory/batches", {
    search: debouncedSearch,
    expiryBucket: bucket,
    page,
    limit,
  });

  // Variant picker for the "add batch" dialog
  useEffect(() => {
    if (!dialogOpen) return;
    void getList<SearchProductDto>("/products/search", { q: debouncedVariantQuery, limit: 25 })
      .then(({ data }) => {
        setVariantOptions(
          data.flatMap((product) =>
            product.variants.map((variant: VariantDto) => ({
              variantId: variant.id,
              label: `${product.name} · ${variant.name}`,
              sku: variant.sku,
            }))
          )
        );
      })
      .catch(() => undefined);
  }, [debouncedVariantQuery, dialogOpen]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (batch: BatchDto) => {
    setEditing(batch);
    setForm({
      variantId: batch.variantId,
      batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate?.slice(0, 10) ?? "",
      expiryDate: batch.expiryDate?.slice(0, 10) ?? "",
      bestBeforeDate: batch.bestBeforeDate?.slice(0, 10) ?? "",
      quantity: String(batch.quantity),
      purchasePrice: batch.purchasePrice === null ? "" : String(batch.purchasePrice),
      mrp: batch.mrp === null ? "" : String(batch.mrp),
      sellingPrice: batch.sellingPrice === null ? "" : String(batch.sellingPrice),
      receivedDate: batch.receivedDate.slice(0, 10),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      variantId: form.variantId,
      batchNumber: form.batchNumber,
      manufacturingDate: form.manufacturingDate || null,
      expiryDate: form.expiryDate || null,
      bestBeforeDate: form.bestBeforeDate || null,
      quantity: Number(form.quantity),
      purchasePrice: form.purchasePrice === "" ? undefined : Number(form.purchasePrice),
      mrp: form.mrp === "" ? undefined : Number(form.mrp),
      sellingPrice: form.sellingPrice === "" ? undefined : Number(form.sellingPrice),
      receivedDate: form.receivedDate,
    };

    try {
      const result = editing
        ? await put(`/inventory/batches/${editing.id}`, payload)
        : await post("/inventory/batches", payload);
      toast.success(result.message);
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save the batch");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      const result = await del(`/inventory/batches/${pendingDelete.id}`);
      toast.success(result.message);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete the batch");
      setPendingDelete(null);
    }
  };

  const columns: Column<BatchDto>[] = [
    {
      key: "batchNumber",
      label: "Batch",
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{row.batchNumber}</Typography>
          <Typography variant="caption">Received {formatDate(row.receivedDate)}</Typography>
        </Box>
      ),
    },
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14 }} noWrap>{row.product.name}</Typography>
          <Typography variant="caption">{row.variant.name} · {row.variant.sku}</Typography>
        </Box>
      ),
    },
    {
      key: "quantity",
      label: "Qty (remaining)",
      align: "center",
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
            {row.remainingQuantity} / {row.quantity}
          </Typography>
        </Box>
      ),
    },
    {
      key: "manufacturingDate",
      label: "Manufactured",
      render: (row) => <Typography variant="caption">{formatDate(row.manufacturingDate)}</Typography>,
    },
    {
      key: "expiryDate",
      label: "Expiry",
      render: (row) => {
        const days = daysUntil(row.expiryDate);
        return (
          <Box>
            <Typography sx={{ fontSize: 13.5 }}>{formatDate(row.expiryDate)}</Typography>
            {days !== null && (
              <Typography
                variant="caption"
                sx={{ color: days < 0 ? "error.main" : days <= 30 ? "warning.main" : "text.secondary" }}
              >
                {days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "bucket",
      label: "Status",
      render: (row) => <StatusChip value={bucketOf(row.expiryDate)} kind="expiry" />,
    },
    {
      key: "sellingPrice",
      label: "Price",
      align: "right",
      render: (row) => (row.sellingPrice === null ? "—" : formatMoney(row.sellingPrice)),
    },
    ...(can("inventory:update")
      ? [
          {
            key: "actions",
            label: "",
            align: "right" as const,
            render: (row: BatchDto) => (
              <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => openEdit(row)}>
                    <EditOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                {can("inventory:delete") && (
                  <Tooltip title="Delete">
                    <IconButton size="small" sx={{ color: "error.main" }} onClick={() => setPendingDelete(row)}>
                      <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ),
          },
        ]
      : []),
  ];

  const addButton = can("inventory:create") ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Add Batch
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Batches"
        subtitle="Batch-level stock with manufacturing and expiry dates"
        breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Batches" }]}
        actions={addButton}
      />

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Batch number, product or SKU"
        />
        <TextField
          select
          size="small"
          label="Expiry"
          value={bucket}
          onChange={(e) => {
            setBucket(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All batches</MenuItem>
          <MenuItem value="expired">Expired</MenuItem>
          <MenuItem value="7_days">Expiring in 7 days</MenuItem>
          <MenuItem value="30_days">Expiring in 30 days</MenuItem>
          <MenuItem value="60_days">Expiring in 60 days</MenuItem>
          <MenuItem value="normal">Normal</MenuItem>
        </TextField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        emptyTitle="No batches found"
        emptyDescription="Add a batch to start tracking expiry dates for this product."
        emptyAction={addButton}
        page={page}
        limit={limit}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        mobileTitle={(row) => `${row.batchNumber} · ${row.product.name}`}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit batch" : "New batch"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, pt: 0.5 }}>
            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              {editing ? (
                <TextField
                  label="Product variant"
                  value={`${editing.product.name} · ${editing.variant.name}`}
                  disabled
                />
              ) : (
                <Autocomplete<VariantOption>
                  options={variantOptions}
                  filterOptions={(x) => x}
                  onInputChange={(_, value) => setVariantQuery(value)}
                  onChange={(_, value) =>
                    setForm((f) => ({ ...f, variantId: value?.variantId ?? "" }))
                  }
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(a, b) => a.variantId === b.variantId}
                  renderInput={(params) => (
                    <TextField {...params} label="Product variant" placeholder="Search products…" />
                  )}
                />
              )}
            </Box>

            <TextField
              label="Batch number"
              value={form.batchNumber}
              onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))}
            />
            <TextField
              label="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              helperText={editing ? "Changes adjust stock" : "Added to stock"}
            />

            <TextField
              label="Manufacturing date"
              type="date"
              value={form.manufacturingDate}
              onChange={(e) => setForm((f) => ({ ...f, manufacturingDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Expiry date"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Best before"
              type="date"
              value={form.bestBeforeDate}
              onChange={(e) => setForm((f) => ({ ...f, bestBeforeDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Received date"
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              label="Purchase price"
              type="number"
              value={form.purchasePrice}
              onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
            />
            <TextField
              label="MRP"
              type="number"
              value={form.mrp}
              onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
            />
            <TextField
              label="Selling price"
              type="number"
              value={form.sellingPrice}
              onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={!form.variantId || !form.batchNumber}
            onClick={save}
          >
            {editing ? "Save changes" : "Add batch"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this batch?"
        message={
          <>
            Batch <strong>{pendingDelete?.batchNumber}</strong> will be removed and its remaining{" "}
            {pendingDelete?.remainingQuantity} units deducted from stock.
          </>
        }
        onConfirm={remove}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
