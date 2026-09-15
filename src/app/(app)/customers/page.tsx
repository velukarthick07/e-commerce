"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { formResolver } from "@/lib/form";
import { useList } from "@/hooks/useApiResource";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { post, put, del, ApiError } from "@/services/api/client";
import { formatDate, formatMoney, initials } from "@/lib/format";
import type { CustomerDto } from "@/types/models";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  line1: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type Values = z.input<typeof schema>;

export default function CustomersPage() {
  const router = useRouter();
  const { can } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomerDto | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const { items, meta, loading, error, reload } = useList<CustomerDto>("/customers", {
    search: debouncedSearch,
    isActive,
    page,
    limit,
    sortBy,
    sortOrder,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: formResolver<Values>(schema),
    defaultValues: { name: "", phone: "", email: "", line1: "", city: "", state: "", postalCode: "", notes: "" },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", phone: "", email: "", line1: "", city: "", state: "", postalCode: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (customer: CustomerDto) => {
    const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
    setEditing(customer);
    reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      line1: address?.line1 ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      postalCode: address?.postalCode ?? "",
      notes: customer.notes ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    const addresses = values.line1
      ? [
          {
            label: "Home",
            line1: values.line1,
            city: values.city ?? "",
            state: values.state ?? "",
            postalCode: values.postalCode ?? "",
            isDefault: true,
          },
        ]
      : [];

    const payload = {
      name: values.name,
      phone: values.phone,
      email: values.email,
      notes: values.notes,
      addresses,
    };

    try {
      const result = editing
        ? await put(`/customers/${editing.id}`, payload)
        : await post("/customers", payload);
      toast.success(result.message);
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save the customer");
    }
  });

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      const result = await del(`/customers/${pendingDelete.id}`);
      toast.success(result.message);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete the customer");
      setPendingDelete(null);
    }
  };

  const columns: Column<CustomerDto>[] = [
    {
      key: "name",
      label: "Customer",
      sortable: true,
      render: (row) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.light", color: "primary.main", fontSize: 13 }}>
            {initials(row.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>{row.name}</Typography>
            <Typography variant="caption">{row.email ?? "No email"}</Typography>
          </Box>
        </Box>
      ),
    },
    { key: "phone", label: "Phone" },
    {
      key: "location",
      label: "Location",
      render: (row) => {
        const address = row.addresses.find((a) => a.isDefault) ?? row.addresses[0];
        return address ? `${address.city}, ${address.state}` : "—";
      },
    },
    {
      key: "totalOrders",
      label: "Orders",
      align: "center",
      sortable: true,
      render: (row) => row.totalOrders,
    },
    {
      key: "totalSpent",
      label: "Total spent",
      align: "right",
      sortable: true,
      render: (row) => (
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{formatMoney(row.totalSpent)}</Typography>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (row) => (
        <Chip
          size="small"
          label={row.isActive ? "Active" : "Inactive"}
          variant={row.isActive ? "filled" : "outlined"}
          sx={row.isActive ? { bgcolor: "#12B76A1A", color: "success.main" } : undefined}
        />
      ),
    },
    {
      key: "createdAt",
      label: "Registered",
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
            <IconButton size="small" onClick={() => router.push(`/customers/${row.id}`)}>
              <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {can("customers:update") && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(row)}>
                <EditOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {can("customers:delete") && (
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

  const addButton = can("customers:create") ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Add Customer
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone who has ordered from the store"
        actions={addButton}
      />

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Name, phone or email"
        />
        <TextField
          select
          size="small"
          label="Status"
          value={isActive}
          onChange={(e) => {
            setIsActive(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 140 }}
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
        emptyTitle="No customers found"
        emptyDescription="Try changing your filters, or add your first customer."
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
          setSortBy(key);
          setSortOrder(order);
        }}
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
        mobileTitle={(row) => row.name}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogContent>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, pt: 0.5 }}>
              <TextField {...register("name")} label="Name" autoFocus error={!!errors.name} helperText={errors.name?.message} />
              <TextField {...register("phone")} label="Phone" error={!!errors.phone} helperText={errors.phone?.message} />
              <Box sx={{ gridColumn: { sm: "span 2" } }}>
                <TextField {...register("email")} label="Email" error={!!errors.email} helperText={errors.email?.message} />
              </Box>
              <Box sx={{ gridColumn: { sm: "span 2" } }}>
                <TextField {...register("line1")} label="Address" />
              </Box>
              <TextField {...register("city")} label="City" />
              <TextField {...register("state")} label="State" />
              <TextField {...register("postalCode")} label="Postal code" />
              <Box sx={{ gridColumn: { sm: "span 2" } }}>
                <TextField {...register("notes")} label="Notes" multiline rows={2} />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {editing ? "Save changes" : "Add customer"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this customer?"
        message={
          <>
            <strong>{pendingDelete?.name}</strong> will be permanently removed. Customers with
            existing orders cannot be deleted — deactivate them instead.
          </>
        }
        onConfirm={remove}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
