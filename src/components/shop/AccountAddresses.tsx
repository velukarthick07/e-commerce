"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  AddressFormDialog,
  emptyAddress,
  toFormValues,
  type AddressFormValues,
} from "./AddressFormDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useShopAuth } from "@/context/ShopAuthContext";
import { useToast } from "@/context/ToastContext";
import { shopApi } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";
import type { ShopAddress } from "@/types/shop";

export function AccountAddresses() {
  const { customer, refresh } = useShopAuth();
  const toast = useToast();

  const [editing, setEditing] = useState<ShopAddress | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ShopAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const addresses = customer?.addresses ?? [];

  function fail(error: unknown, fallback: string) {
    toast.error(error instanceof ApiError ? error.message : fallback);
  }

  async function save(values: AddressFormValues) {
    setSaving(true);
    const body = {
      label: values.label,
      line1: values.line1,
      line2: values.line2 || undefined,
      city: values.city,
      state: values.state,
      postalCode: values.postalCode,
      landmark: values.landmark || undefined,
      isDefault: values.isDefault,
    };
    try {
      if (editing) await shopApi.updateAddress(editing.id, body);
      else await shopApi.addAddress(body);
      await refresh();
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Address updated" : "Address saved");
    } catch (error) {
      fail(error, "Could not save that address");
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(address: ShopAddress) {
    setBusyId(address.id);
    try {
      await shopApi.setDefaultAddress(address.id);
      await refresh();
      toast.success(`${address.label} is now your default address`);
    } catch (error) {
      fail(error, "Could not update your default address");
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await shopApi.removeAddress(pendingDelete.id);
      await refresh();
      toast.success("Address removed");
    } catch (error) {
      fail(error, "Could not remove that address");
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <Typography variant="body2" color="text.secondary">
          Save as many addresses as you like and pick one at checkout.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddLocationAltOutlinedIcon />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Add address
        </Button>
      </Stack>

      {addresses.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            No saved addresses
          </Typography>
          <Typography color="text.secondary">
            Add one now, or enter it when you check out — we&apos;ll save it for you.
          </Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {addresses.map((address) => (
            <Card
              key={address.id}
              variant="outlined"
              sx={{
                p: 2,
                borderColor: address.isDefault ? "primary.main" : "divider",
                opacity: busyId === address.id ? 0.6 : 1,
              }}
            >
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
                    {address.label}
                  </Typography>
                  {address.isDefault ? (
                    <Chip size="small" label="Default" color="primary" />
                  ) : null}
                </Stack>
                <Stack direction="row">
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditing(address);
                        setDialogOpen(true);
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => setPendingDelete(address)}>
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {[address.line1, address.line2, address.city, address.state, address.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </Typography>
              {address.landmark ? (
                <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                  Landmark: {address.landmark}
                </Typography>
              ) : null}

              {!address.isDefault ? (
                <Button size="small" sx={{ mt: 1.5, px: 0 }} onClick={() => makeDefault(address)}>
                  Set as default
                </Button>
              ) : null}
            </Card>
          ))}
        </Box>
      )}

      <AddressFormDialog
        key={editing?.id ?? (dialogOpen ? "new" : "closed")}
        open={dialogOpen}
        initial={editing ? toFormValues(editing) : emptyAddress}
        title={editing ? "Edit address" : "Add a new address"}
        saving={saving}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={save}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this address?"
        message={
          pendingDelete
            ? `${pendingDelete.label} — ${pendingDelete.line1}, ${pendingDelete.city}`
            : ""
        }
        confirmLabel="Remove"
        destructive
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </Stack>
  );
}
