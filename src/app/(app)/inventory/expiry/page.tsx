"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { StatusChip } from "@/components/common/StatusChip";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getList, post, ApiError } from "@/services/api/client";
import { daysUntil, formatDate, formatNumber } from "@/lib/format";
import type { BatchDto, CategoryDto } from "@/types/models";

interface ExpiryBucketSummary {
  bucket: string;
  batches: number;
  units: number;
}

const BUCKET_META: Record<string, { label: string; color: string; bg: string }> = {
  expired: { label: "Expired", color: "#F04438", bg: "#F044381A" },
  "7_days": { label: "Expiring in 7 days", color: "#F79009", bg: "#F790091A" },
  "30_days": { label: "Expiring in 30 days", color: "#F79009", bg: "#F790091A" },
  "60_days": { label: "Expiring in 60 days", color: "#2E90FA", bg: "#2E90FA1A" },
  normal: { label: "Normal", color: "#12B76A", bg: "#12B76A1A" },
};

const BUCKET_ORDER = ["expired", "7_days", "30_days", "60_days", "normal"];

function bucketOf(expiryDate: string | null): string {
  const days = daysUntil(expiryDate);
  if (days === null) return "normal";
  if (days < 0) return "expired";
  if (days <= 7) return "7_days";
  if (days <= 30) return "30_days";
  if (days <= 60) return "60_days";
  return "normal";
}

export default function ExpiryPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [nonce, setNonce] = useState(0);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    void getList<CategoryDto>("/categories/tree")
      .then(({ data }) => setCategories(data))
      .catch(() => undefined);
  }, []);

  /**
   * The expiry endpoint returns bucket counts plus a paginated batch list.
   * Results are tagged with their request so `loading` is derived rather than
   * set synchronously inside the effect.
   */
  const requestKey = `${debouncedSearch}|${bucket}|${categoryId}|${from}|${to}|${page}|${limit}|${nonce}`;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    summary: ExpiryBucketSummary[] | null;
    batches: BatchDto[];
    total: number;
    error: string | null;
  } | null>(null);

  const loading = snapshot?.key !== requestKey;
  const summary = snapshot?.summary ?? null;
  const batches = snapshot?.key === requestKey ? snapshot.batches : [];
  const total = snapshot?.key === requestKey ? snapshot.total : 0;
  const error = snapshot?.key === requestKey ? snapshot.error : null;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await getList<never>("/inventory/expiry", {
          search: debouncedSearch,
          expiryBucket: bucket,
          categoryId,
          from: from || undefined,
          to: to || undefined,
          page,
          limit,
        });
        const payload = result.data as unknown as {
          summary: ExpiryBucketSummary[];
          batches: BatchDto[];
        };
        if (!cancelled) {
          setSnapshot({
            key: requestKey,
            summary: payload.summary,
            batches: payload.batches,
            total: result.meta?.total ?? 0,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSnapshot({
            key: requestKey,
            summary: null,
            batches: [],
            total: 0,
            error: err instanceof ApiError ? err.message : "Unable to load expiry data",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, bucket, categoryId, from, to, page, limit, requestKey]);

  const writeOff = async () => {
    try {
      const result = await post("/inventory/expiry/write-off");
      toast.success(result.message);
      setWriteOffOpen(false);
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to write off expired stock");
      setWriteOffOpen(false);
    }
  };

  const expiredCount = summary?.find((s) => s.bucket === "expired")?.batches ?? 0;

  const columns: Column<BatchDto>[] = [
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>{row.product.name}</Typography>
          <Typography variant="caption">{row.variant.name} · {row.variant.sku}</Typography>
        </Box>
      ),
    },
    { key: "batchNumber", label: "Batch" },
    {
      key: "remainingQuantity",
      label: "Remaining",
      align: "center",
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
          {row.remainingQuantity} {row.product.unit}
        </Typography>
      ),
    },
    {
      key: "expiryDate",
      label: "Expiry date",
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
                {days < 0 ? `expired ${Math.abs(days)} days ago` : `in ${days} days`}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusChip value={bucketOf(row.expiryDate)} kind="expiry" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Expiry Management"
        subtitle="Track batches approaching expiry and write off what has lapsed"
        breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Expiry" }]}
        actions={
          can("inventory:delete") && expiredCount > 0 ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteSweepOutlinedIcon />}
              onClick={() => setWriteOffOpen(true)}
            >
              Write off expired
            </Button>
          ) : null
        }
      />

      {/* Bucket cards double as filters */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
          mb: 3,
        }}
      >
        {BUCKET_ORDER.map((key) => {
          const meta = BUCKET_META[key];
          const row = summary?.find((s) => s.bucket === key);
          const active = bucket === key;

          return (
            <Card
              key={key}
              onClick={() => {
                setBucket(active ? "all" : key);
                setPage(1);
              }}
              sx={{
                p: 2,
                cursor: "pointer",
                borderColor: active ? meta.color : "divider",
                borderWidth: active ? 1.5 : 1,
                bgcolor: active ? meta.bg : "#fff",
                transition: "all .12s",
                "&:hover": { borderColor: meta.color },
              }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: meta.color, mb: 0.75 }}>
                {meta.label}
              </Typography>
              {summary === null ? (
                <Skeleton width={60} height={30} />
              ) : (
                <>
                  <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
                    {formatNumber(row?.batches ?? 0)}
                  </Typography>
                  <Typography variant="caption">
                    {formatNumber(row?.units ?? 0)} units
                  </Typography>
                </>
              )}
            </Card>
          );
        })}
      </Box>

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Product, batch or SKU"
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
          type="date"
          size="small"
          label="Expiry from"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          type="date"
          size="small"
          label="Expiry to"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        {bucket !== "all" && (
          <Button size="small" onClick={() => setBucket("all")}>
            Clear bucket filter
          </Button>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        rows={batches}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        emptyTitle="No batches match"
        emptyDescription="Nothing falls into this expiry window."
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        mobileTitle={(row) => `${row.product.name} · ${row.batchNumber}`}
      />

      <ConfirmDialog
        open={writeOffOpen}
        title="Write off all expired stock?"
        confirmLabel="Write off"
        message={
          <>
            Every expired batch that still holds stock will be zeroed and recorded as an{" "}
            <strong>expired stock</strong> transaction. This cannot be undone.
          </>
        }
        onConfirm={writeOff}
        onClose={() => setWriteOffOpen(false)}
      />
    </>
  );
}
