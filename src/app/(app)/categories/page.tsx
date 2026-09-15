"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formResolver } from "@/lib/form";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getList, post, put, del, ApiError } from "@/services/api/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { CategoryDto } from "@/types/models";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  description: z.string().trim().optional(),
  parentId: z.union([z.literal(""), z.coerce.number().int().positive()]),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});

type Values = z.input<typeof schema>;

export default function CategoriesPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [tree, setTree] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryDto | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: formResolver<Values>(schema),
    defaultValues: { name: "", description: "", parentId: "", isActive: true, sortOrder: 0 },
  });

  const load = useCallback(async () => {
    try {
      const { data } = await getList<CategoryDto>("/categories/tree");
      setTree(data);
    } catch {
      toast.error("Unable to load categories");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getList<CategoryDto>("/categories/tree");
        if (!cancelled) setTree(data);
      } catch {
        /* the empty state covers this */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = (parentId?: number) => {
    setEditing(null);
    reset({ name: "", description: "", parentId: parentId ?? "", isActive: true, sortOrder: 0 });
    setDialogOpen(true);
  };

  const openEdit = (category: CategoryDto) => {
    setEditing(category);
    reset({
      name: category.name,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    });
    setDialogOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, parentId: values.parentId === "" ? null : Number(values.parentId) };
    try {
      const result = editing
        ? await put(`/categories/${editing.id}`, payload)
        : await post("/categories", payload);
      toast.success(result.message);
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to save the category");
    }
  });

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      const result = await del(`/categories/${pendingDelete.id}`);
      toast.success(result.message);
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to delete the category");
      setPendingDelete(null);
    }
  };

  const addButton = can("categories:create") ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate()}>
      Add Category
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Two-level category tree used across the catalogue"
        actions={addButton}
      />

      {loading ? (
        <Box sx={{ display: "grid", gap: 2 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={110} />
          ))}
        </Box>
      ) : tree.length === 0 ? (
        <Card>
          <EmptyState
            title="No categories yet"
            description="Create your first category to start organising products."
            icon={<CategoryOutlinedIcon />}
            action={addButton}
          />
        </Card>
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {tree.map((parent) => (
            <Card key={parent.id}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      bgcolor: "primary.light",
                      color: "primary.main",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <CategoryOutlinedIcon sx={{ fontSize: 19 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{parent.name}</Typography>
                      {!parent.isActive && <Chip size="small" label="Inactive" variant="outlined" />}
                    </Box>
                    <Typography variant="caption">
                      {parent._count?.products ?? 0} products · {parent.children?.length ?? 0} subcategories
                    </Typography>
                  </Box>

                  {can("categories:create") && (
                    <Tooltip title="Add subcategory">
                      <IconButton size="small" onClick={() => openCreate(parent.id)}>
                        <AddIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {can("categories:update") && (
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(parent)}>
                        <EditOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {can("categories:delete") && (
                    <Tooltip title="Delete">
                      <IconButton size="small" sx={{ color: "error.main" }} onClick={() => setPendingDelete(parent)}>
                        <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {(parent.children?.length ?? 0) > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" },
                      pl: { sm: 6 },
                    }}
                  >
                    {parent.children!.map((child) => (
                      <Box
                        key={child.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1.25,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 2,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 500 }} noWrap>
                            {child.name}
                          </Typography>
                          <Typography variant="caption">
                            {child._count?.products ?? 0} products
                          </Typography>
                        </Box>
                        {can("categories:update") && (
                          <IconButton size="small" onClick={() => openEdit(child)}>
                            <EditOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                        {can("categories:delete") && (
                          <IconButton
                            size="small"
                            sx={{ color: "error.main" }}
                            onClick={() => setPendingDelete(child)}
                          >
                            <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
        <Box component="form" onSubmit={onSubmit} noValidate>
          <DialogContent>
            <Box sx={{ display: "grid", gap: 2, pt: 0.5 }}>
              <TextField
                {...register("name")}
                label="Category name"
                autoFocus
                error={!!errors.name}
                helperText={errors.name?.message}
              />
              <TextField
                select
                label="Parent category"
                value={watch("parentId")}
                onChange={(e) => setValue("parentId", e.target.value === "" ? "" : Number(e.target.value))}
                helperText="Leave empty to create a top-level category"
              >
                <MenuItem value="">None (top level)</MenuItem>
                {tree
                  .filter((c) => !editing || c.id !== editing.id)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
              </TextField>
              <TextField {...register("description")} label="Description" multiline rows={2} />
              <TextField {...register("sortOrder")} label="Sort order" type="number" />
              <FormControlLabel
                control={
                  <Switch
                    checked={watch("isActive")}
                    onChange={(e) => setValue("isActive", e.target.checked)}
                  />
                }
                label="Active"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {editing ? "Save changes" : "Create category"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this category?"
        message={
          <>
            <strong>{pendingDelete?.name}</strong> will be removed. Categories that still contain
            products or subcategories cannot be deleted.
          </>
        }
        onConfirm={remove}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
