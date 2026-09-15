"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useList } from "@/hooks/useApiResource";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { post, put, del, ApiError } from "@/services/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import type { CouponDto } from "@/types/models";

const EMPTY = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "10",
  minOrderValue: "0",
  maxDiscount: "",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

/** Derives a human status from the coupon's dates and usage. */
function statusOf(coupon: CouponDto): { label: string; color: "success" | "error" | "warning" | "default" } {
  const now = Date.now();
  if (!coupon.isActive) return { label: "Inactive", color: "default" };
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now)
    return { label: "Expired", color: "error" };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now)
    return { label: "Scheduled", color: "warning" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { label: "Exhausted", color: "error" };
  return { label: "Active", color: "success" };
}

export default function CouponsPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CouponDto | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CouponDto | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const { items, meta, loading, error, reload } = useList<CouponDto>("/coupons", {
    search: debouncedSearch,
    status,
    page,
    limit,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setDialogOpen(true);
  };

  const openEdit = (coupon: CouponDto) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderValue: String(coupon.minOrderValue),
      maxDiscount: coupon.maxDiscount === null ? "" : String(coupon.maxDiscount),
      usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
      startsAt: coupon.startsAt?.slice(0, 10) ?? "",
      expiresAt: coupon.expiresAt?.slice(0, 10) ?? "",
      isActive: coupon.isActive,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      code: form.code.toUpperCase(),
      description: form.description,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderValue: Number(form.minOrderValue),
      maxDiscount: form.maxDiscount === "" ? undefined : Number(form.maxDiscount),
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      isActive: form.isActive,
    };

    try {
      const result = editing
        ? await put(`/coupons/${editing.id}`, payload)
        : await post("/coupons", payload);
      toast.success(result.message);
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save the coupon");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      const result = await del(`/coupons/${pendingDelete.id}`);
      toast.success(result.message);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete the coupon");
      setPendingDelete(null);
    }
  };

  const columns: Column<CouponDto>[] = [
    {
      key: "code",
      label: "Code",
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.03em" }}>
            {row.code}
          </Typography>
          {row.description && <Typography variant="caption">{row.description}</Typography>}
        </Box>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          {row.discountType === "PERCENTAGE"
            ? `${row.discountValue}%`
            : formatMoney(row.discountValue)}
        </Typography>
      ),
    },
    {
      key: "minOrderValue",
      label: "Min order",
      align: "right",
      render: (row) => formatMoney(row.minOrderValue),
    },
    {
      key: "maxDiscount",
      label: "Max discount",
      align: "right",
      render: (row) => (row.maxDiscount === null ? "—" : formatMoney(row.maxDiscount)),
    },
    {
      key: "usage",
      label: "Usage",
      align: "center",
      render: (row) => (
        <Typography sx={{ fontSize: 14 }}>
          {row.usedCount} / {row.usageLimit ?? "∞"}
        </Typography>
      ),
    },
    {
      key: "expiresAt",
      label: "Expires",
      render: (row) => <Typography variant="caption">{formatDate(row.expiresAt)}</Typography>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const s = statusOf(row);
        return <Chip size="small" label={s.label} color={s.color} variant={s.color === "default" ? "outlined" : "filled"} />;
      },
    },
    ...(can("coupons:update")
      ? [
          {
            key: "actions",
            label: "",
            align: "right" as const,
            render: (row: CouponDto) => (
              <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => openEdit(row)}>
                    <EditOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                {can("coupons:delete") && (
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

  const addButton = can("coupons:create") ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Add Coupon
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Discount codes validated on the server at checkout"
        actions={addButton}
      />

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Coupon code or description"
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
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">All coupons</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="scheduled">Scheduled</MenuItem>
          <MenuItem value="expired">Expired</MenuItem>
          <MenuItem value="exhausted">Exhausted</MenuItem>
        </TextField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        emptyTitle="No coupons yet"
        emptyDescription="Create a coupon to offer discounts at checkout."
        emptyAction={addButton}
        page={page}
        limit={limit}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        mobileTitle={(row) => row.code}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, pt: 0.5 }}>
            <TextField
              label="Coupon code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocalOfferOutlinedIcon sx={{ fontSize: 17 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              label="Discount type"
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
            >
              <MenuItem value="PERCENTAGE">Percentage</MenuItem>
              <MenuItem value="FIXED_AMOUNT">Fixed amount</MenuItem>
            </TextField>

            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Box>

            <TextField
              label="Discount value"
              type="number"
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              slotProps={{
                input: {
                  [form.discountType === "PERCENTAGE" ? "endAdornment" : "startAdornment"]: (
                    <InputAdornment position={form.discountType === "PERCENTAGE" ? "end" : "start"}>
                      {form.discountType === "PERCENTAGE" ? "%" : "₹"}
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Minimum order value"
              type="number"
              value={form.minOrderValue}
              onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
            />
            <TextField
              label="Maximum discount"
              type="number"
              value={form.maxDiscount}
              onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
              helperText="Leave empty for no cap"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
            />
            <TextField
              label="Usage limit"
              type="number"
              value={form.usageLimit}
              onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
              helperText="Leave empty for unlimited"
            />
            <TextField
              label="Starts at"
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Expires at"
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" loading={saving} disabled={!form.code} onClick={save}>
            {editing ? "Save changes" : "Create coupon"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this coupon?"
        message={
          <>
            Coupon <strong>{pendingDelete?.code}</strong> will be removed. Coupons already used on
            orders cannot be deleted — deactivate them instead.
          </>
        }
        onConfirm={remove}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
