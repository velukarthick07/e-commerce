"use client";

import { Controller, useForm } from "react-hook-form";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { formResolver } from "@/lib/form";
import { storefrontAddressSchema } from "@/validators/storefront.validator";
import type { ShopAddress } from "@/types/shop";

export interface AddressFormValues {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  landmark: string;
  isDefault: boolean;
}

const LABELS = ["Home", "Work", "Other"];

export const emptyAddress: AddressFormValues = {
  label: "Home",
  line1: "",
  line2: "",
  city: "",
  state: "Tamil Nadu",
  postalCode: "",
  landmark: "",
  isDefault: false,
};

export function toFormValues(address: ShopAddress): AddressFormValues {
  return {
    label: address.label,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    landmark: address.landmark ?? "",
    isDefault: address.isDefault,
  };
}

export function AddressFormDialog({
  open,
  initial,
  title,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: AddressFormValues;
  title: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: AddressFormValues) => void | Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: formResolver<AddressFormValues>(storefrontAddressSchema),
    defaultValues: initial,
    // Remounting on `initial` keeps the dialog a plain controlled form: no
    // effect has to push new values in when a different address is edited.
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              pt: 0.5,
            }}
          >
            <Controller
              control={control}
              name="label"
              render={({ field }) => (
                <TextField {...field} select label="Save as" fullWidth>
                  {LABELS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="postalCode"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="PIN code"
                  inputMode="numeric"
                  error={Boolean(errors.postalCode)}
                  helperText={errors.postalCode?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              control={control}
              name="line1"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="House / flat, street"
                  error={Boolean(errors.line1)}
                  helperText={errors.line1?.message}
                  fullWidth
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                />
              )}
            />
            <Controller
              control={control}
              name="line2"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Area / locality (optional)"
                  fullWidth
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                />
              )}
            />
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="City"
                  error={Boolean(errors.city)}
                  helperText={errors.city?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="State"
                  error={Boolean(errors.state)}
                  helperText={errors.state?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              control={control}
              name="landmark"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Landmark (optional)"
                  fullWidth
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                />
              )}
            />
            <Controller
              control={control}
              name="isDefault"
              render={({ field }) => (
                <FormControlLabel
                  sx={{ gridColumn: { sm: "1 / -1" } }}
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Make this my default delivery address"
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={saving}>
            Save address
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
