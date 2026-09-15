"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useShopAuth } from "@/context/ShopAuthContext";
import { useToast } from "@/context/ToastContext";
import { shopApi } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";

export function AccountProfile() {
  const { customer, refresh } = useShopAuth();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });

  // Adjust-during-render: the form starts from whoever is signed in, and
  // re-seeds if the account changes, without an effect writing state.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (customer && seededFor !== customer.id) {
    setSeededFor(customer.id);
    setForm({ name: customer.name, email: customer.email ?? "" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await shopApi.updateProfile({
        name: form.name,
        email: form.email || undefined,
      });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your details");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3, maxWidth: 520 }}>
      <Box component="form" onSubmit={save}>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            Your mobile number identifies your account and is verified by code,
            so it can&apos;t be changed here.
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Mobile number"
            value={customer?.phone ?? ""}
            disabled
            fullWidth
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">+91</InputAdornment>,
              },
            }}
          />

          <TextField
            label="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoComplete="name"
            fullWidth
          />

          <TextField
            label="Email (optional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            fullWidth
            helperText="We'll use this for order receipts."
          />

          <Button
            type="submit"
            variant="contained"
            loading={saving}
            disabled={form.name.trim().length < 2}
            sx={{ alignSelf: "flex-start" }}
          >
            Save changes
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
