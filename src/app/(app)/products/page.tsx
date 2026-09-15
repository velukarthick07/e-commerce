"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import StarIcon from "@mui/icons-material/Star";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
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
import { del, getList, ApiError } from "@/services/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import type { CategoryDto, ProductDto } from "@/types/models";

/** Aggregates variant stock into a single product-level status. */
function stockOf(product: ProductDto) {
  const total = product.variants.reduce(
    (sum, v) => sum + (v.inventory?.currentStock ?? 0),
    0
  );
  const anyLow = product.variants.some(
    (v) => (v.inventory?.currentStock ?? 0) <= (v.inventory?.minStock ?? 0)
  );
  const status = total <= 0 ? "out_of_stock" : anyLow ? "low_stock" : "in_stock";
  return { total, status };
}

export default function ProductsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const [isActive, setIsActive] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [pendingDelete, setPendingDelete] = useState<ProductDto | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    void getList<CategoryDto>("/categories/tree")
      .then(({ data }) => setCategories(data))
      .catch(() => undefined);
  }, []);

  const { items, meta, loading, error, reload } = useList<ProductDto>("/products", {
    search: debouncedSearch,
    categoryId,
    stockStatus,
    isActive,
    page,
    limit,
    sortBy,
    sortOrder,
  });

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      const result = await del(`/products/${pendingDelete.id}`);
      toast.success(result.message);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete this product");
      setPendingDelete(null);
    }
  };

  const columns: Column<ProductDto>[] = [
    {
      key: "name",
      label: "Product",
      sortable: true,
      render: (row) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Avatar
            src={row.images[0] ?? undefined}
            variant="rounded"
            sx={{ width: 38, height: 38, bgcolor: "primary.light", color: "primary.main" }}
          >
            <Inventory2OutlinedIcon sx={{ fontSize: 19 }} />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                {row.name}
              </Typography>
              {row.isFeatured && (
                <Tooltip title="Featured">
                  <StarIcon sx={{ fontSize: 14, color: "warning.main" }} />
                </Tooltip>
              )}
            </Box>
            <Typography variant="caption">
              {row.sku}
              {row.brand ? ` · ${row.brand}` : ""}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 13.5 }}>{row.category.name}</Typography>
          {row.subcategory && (
            <Typography variant="caption">{row.subcategory.name}</Typography>
          )}
        </Box>
      ),
    },
    {
      key: "variants",
      label: "Variants",
      align: "center",
      render: (row) => (
        <Chip size="small" variant="outlined" label={row.variants.length} />
      ),
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      sortable: true,
      render: (row) => (
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
            {formatMoney(row.sellingPrice)}
          </Typography>
          {row.mrp > row.sellingPrice && (
            <Typography variant="caption" sx={{ textDecoration: "line-through" }}>
              {formatMoney(row.mrp)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      align: "center",
      render: (row) => {
        const { total, status } = stockOf(row);
        return (
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {total} {row.unit}
            </Typography>
            <StatusChip value={status} kind="stock" />
          </Box>
        );
      },
    },
    {
      key: "isActive",
      label: "Status",
      render: (row) => (
        <Chip
          size="small"
          label={row.isActive ? "Active" : "Inactive"}
          color={row.isActive ? "success" : "default"}
          variant={row.isActive ? "filled" : "outlined"}
          sx={row.isActive ? { bgcolor: "#12B76A1A", color: "success.main" } : undefined}
        />
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (row) => <Typography variant="caption">{formatDate(row.createdAt)}</Typography>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => router.push(`/products/${row.id}`)}>
              <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {can("products:update") && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => router.push(`/products/${row.id}/edit`)}>
                <EditOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {can("products:delete") && (
            <Tooltip title="Delete">
              <IconButton size="small" sx={{ color: "error.main" }} onClick={() => setPendingDelete(row)}>
                <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  const addButton = can("products:create") ? (
    <Button component={Link} href="/products/new" variant="contained" startIcon={<AddIcon />}>
      Add Product
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Your full FMCG catalogue with variants and live stock"
        actions={addButton}
      />

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Name, SKU, barcode or brand"
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
          label="Stock"
          value={stockStatus}
          onChange={(e) => {
            setStockStatus(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All stock</MenuItem>
          <MenuItem value="in_stock">In stock</MenuItem>
          <MenuItem value="low_stock">Low stock</MenuItem>
          <MenuItem value="out_of_stock">Out of stock</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Status"
          value={isActive}
          onChange={(e) => {
            setIsActive(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 130 }}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        emptyTitle="No products found"
        emptyDescription="Try changing your filters, or add your first product."
        emptyAction={addButton}
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
          setSortBy(key === "price" ? "sellingPrice" : key);
          setSortOrder(order);
        }}
        onRowClick={(row) => router.push(`/products/${row.id}`)}
        mobileTitle={(row) => row.name}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this product?"
        message={
          <>
            <strong>{pendingDelete?.name}</strong> and all of its variants will be permanently
            removed. Products that already appear on orders cannot be deleted — deactivate them
            instead.
          </>
        }
        onConfirm={remove}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
