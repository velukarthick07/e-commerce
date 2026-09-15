"use client";

import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { SearchField } from "@/components/common/SearchField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useList } from "@/hooks/useApiResource";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getList, post, put, del, ApiError } from "@/services/api/client";
import { formatDateTime, initials } from "@/lib/format";
import type { UserDto } from "@/types/models";

interface RoleOption {
  id: number;
  name: string;
  label: string;
}

const EMPTY = { name: "", email: "", phone: "", password: "", role: "STAFF", isActive: true };

export default function UsersPage() {
  const { can, user: currentUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserDto | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  const { items, meta, loading, error, reload } = useList<UserDto>("/users", {
    search: debouncedSearch,
    role,
    page,
    limit,
  });

  useEffect(() => {
    void getList<RoleOption>("/users/roles")
      .then(({ data }) => setRoles(data))
      .catch(() => undefined);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setDialogOpen(true);
  };

  const openEdit = (user: UserDto) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      password: "",
      role: user.role.name,
      isActive: user.isActive,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;

    try {
      const result = editing
        ? await put(`/users/${editing.id}`, payload)
        : await post("/users", { ...payload, password: form.password });
      toast.success(result.message);
      setDialogOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save the user");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      const result = await del(`/users/${pendingDelete.id}`);
      toast.success(result.message);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete the user");
      setPendingDelete(null);
    }
  };

  const columns: Column<UserDto>[] = [
    {
      key: "name",
      label: "User",
      render: (row) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.light", color: "primary.main", fontSize: 13 }}>
            {initials(row.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
              {row.name}
              {row.id === currentUser?.id && (
                <Chip size="small" label="You" sx={{ ml: 1, height: 18, fontSize: 10.5 }} />
              )}
            </Typography>
            <Typography variant="caption">{row.email}</Typography>
          </Box>
        </Box>
      ),
    },
    { key: "phone", label: "Phone", render: (row) => row.phone ?? "—" },
    {
      key: "role",
      label: "Role",
      render: (row) => <Chip size="small" color="primary" variant="outlined" label={row.role.label} />,
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
      key: "lastLoginAt",
      label: "Last sign-in",
      render: (row) => <Typography variant="caption">{formatDateTime(row.lastLoginAt)}</Typography>,
    },
    ...(can("users:update")
      ? [
          {
            key: "actions",
            label: "",
            align: "right" as const,
            render: (row: UserDto) => (
              <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => openEdit(row)}>
                    <EditOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                {can("users:delete") && row.id !== currentUser?.id && (
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

  const addButton = can("users:create") ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
      Add User
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Staff accounts and the roles that control their access"
        actions={addButton}
      />

      <FilterBar>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Name, email or phone"
        />
        <TextField
          select
          size="small"
          label="Role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="all">All roles</MenuItem>
          {roles.map((r) => (
            <MenuItem key={r.id} value={r.name}>{r.label}</MenuItem>
          ))}
        </TextField>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(row) => String(row.id)}
        loading={loading}
        error={error}
        emptyTitle="No users found"
        emptyDescription="Try changing your filters, or invite a team member."
        emptyAction={addButton}
        page={page}
        limit={limit}
        total={meta?.total ?? 0}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        mobileTitle={(row) => row.name}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, pt: 0.5 }}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Box>
            <Box sx={{ gridColumn: { sm: "span 2" } }}>
              <TextField
                label={editing ? "New password (leave blank to keep)" : "Password"}
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                helperText="At least 8 characters, including a letter and a number"
              />
            </Box>
            <TextField
              select
              label="Role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.name}>{r.label}</MenuItem>
              ))}
            </TextField>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            loading={saving}
            disabled={!form.name || !form.email || (!editing && !form.password)}
            onClick={save}
          >
            {editing ? "Save changes" : "Create user"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this user?"
        message={
          <>
            <strong>{pendingDelete?.name}</strong> will lose access immediately. The last active
            super admin cannot be removed.
          </>
        }
        onConfirm={remove}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
