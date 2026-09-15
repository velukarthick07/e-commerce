"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { StatusChip } from "@/components/common/StatusChip";
import { useList } from "@/hooks/useApiResource";
import { formatDateTime, humanise } from "@/lib/format";
import type { InventoryTxDto } from "@/types/models";

const TX_TYPES = [
  "STOCK_ADDED", "STOCK_REMOVED", "ORDER_DEDUCTION",
  "RETURN", "MANUAL_ADJUSTMENT", "EXPIRED_STOCK",
];

/**
 * The stock ledger is a dense, read-only log, so it uses MUI X DataGrid
 * rather than the card-collapsing DataTable used by the CRUD pages.
 */
export default function TransactionsPage() {
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const { items, meta, loading, error } = useList<InventoryTxDto>("/inventory/transactions", {
    type,
    from: from || undefined,
    to: to || undefined,
    page,
    limit,
  });

  const columns: GridColDef<InventoryTxDto>[] = [
    {
      field: "createdAt",
      headerName: "Date",
      width: 165,
      valueGetter: (_value, row) => formatDateTime(row.createdAt),
    },
    {
      field: "type",
      headerName: "Type",
      width: 165,
      sortable: false,
      renderCell: (params) => <StatusChip value={params.row.type} kind="transaction" />,
    },
    {
      field: "product",
      headerName: "Product",
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ lineHeight: 1.35, py: 0.75 }}>
          <Typography sx={{ fontSize: 13.5 }} noWrap>{params.row.product.name}</Typography>
          <Typography variant="caption">{params.row.variant.name}</Typography>
        </Box>
      ),
    },
    {
      field: "quantity",
      headerName: "Change",
      width: 100,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 700,
            color: params.row.quantity >= 0 ? "success.main" : "error.main",
          }}
        >
          {params.row.quantity > 0 ? `+${params.row.quantity}` : params.row.quantity}
        </Typography>
      ),
    },
    {
      field: "stock",
      headerName: "Stock",
      width: 120,
      sortable: false,
      valueGetter: (_value, row) => `${row.previousStock} → ${row.newStock}`,
    },
    {
      field: "batch",
      headerName: "Batch",
      width: 150,
      sortable: false,
      valueGetter: (_value, row) => row.batch?.batchNumber ?? "—",
    },
    {
      field: "order",
      headerName: "Reference",
      width: 175,
      sortable: false,
      valueGetter: (_value, row) =>
        row.order?.orderNumber ?? humanise(row.referenceType ?? "") ?? "—",
    },
    {
      field: "user",
      headerName: "By",
      width: 140,
      sortable: false,
      valueGetter: (_value, row) => row.user?.name ?? "System",
    },
  ];

  return (
    <>
      <PageHeader
        title="Inventory Transactions"
        subtitle="Every stock movement, with its batch and reference"
        breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Transactions" }]}
      />

      <FilterBar>
        <TextField
          select
          size="small"
          label="Type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All movements</MenuItem>
          {TX_TYPES.map((t) => (
            <MenuItem key={t} value={t}>{humanise(t)}</MenuItem>
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
          sx={{ minWidth: 160 }}
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
          sx={{ minWidth: 160 }}
        />
      </FilterBar>

      <Card sx={{ p: 0, overflow: "hidden" }}>
        <DataGrid
          rows={items}
          columns={columns}
          getRowId={(row) => row.id}
          loading={loading}
          rowCount={meta?.total ?? 0}
          paginationMode="server"
          sortingMode="server"
          paginationModel={{ page: page - 1, pageSize: limit }}
          onPaginationModelChange={(model) => {
            setPage(model.page + 1);
            setLimit(model.pageSize);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick
          disableColumnMenu
          autoHeight
          rowHeight={58}
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": { bgcolor: "#FAFAFC" },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontSize: 12.5,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "text.secondary",
            },
            "& .MuiDataGrid-cell": { fontSize: 14 },
            "& .MuiDataGrid-row:hover": { bgcolor: "#FCFBFE" },
          }}
          slotProps={{
            loadingOverlay: { variant: "skeleton", noRowsVariant: "skeleton" },
          }}
        />
        {error && (
          <Typography sx={{ p: 2, color: "error.main", fontSize: 14 }}>{error}</Typography>
        )}
      </Card>
    </>
  );
}
