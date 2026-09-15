"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

const schema = z
  .object({
    storeName: z.string().trim().min(2, "Store name is required").max(120),
    name: z.string().trim().min(2, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AdministratorFormValues = z.infer<typeof schema>;

interface Props {
  defaultValues: AdministratorFormValues;
  onBack: () => void;
  onContinue: (values: AdministratorFormValues) => void;
}

export function AdministratorStep({ defaultValues, onBack, onContinue }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AdministratorFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const submit = handleSubmit((values) => onContinue(values));

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Typography variant="h2" sx={{ fontSize: 21, fontWeight: 700, mb: 0.5 }}>
        Store and administrator
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: 14, mb: 2.5 }}>
        The first account is a Super Admin. Everything else — staff accounts,
        tax, delivery charges, the catalogue — is configured from inside the
        application afterwards.
      </Typography>

      <Controller
        name="storeName"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Store name"
            fullWidth
            margin="normal"
            error={Boolean(errors.storeName)}
            helperText={errors.storeName?.message ?? "Shown to customers on the storefront and on receipts"}
          />
        )}
      />

      <Divider sx={{ my: 2.5 }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.6 }}>
          Administrator
        </Typography>
      </Divider>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Full name"
              fullWidth
              error={Boolean(errors.name)}
              helperText={errors.name?.message ?? " "}
            />
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Phone (optional)"
              fullWidth
              error={Boolean(errors.phone)}
              helperText={errors.phone?.message ?? " "}
            />
          )}
        />
      </Box>

      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            error={Boolean(errors.email)}
            helperText={errors.email?.message ?? "Used to sign in, and to receive password resets"}
            slotProps={{ htmlInput: { autoComplete: "username" } }}
          />
        )}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 1 }}>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              error={Boolean(errors.password)}
              helperText={errors.password?.message ?? "At least 8 characters, with a letter and a number"}
              slotProps={{
                htmlInput: { autoComplete: "new-password" },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        />
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Confirm password"
              type={showPassword ? "text" : "password"}
              fullWidth
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword?.message ?? " "}
              slotProps={{ htmlInput: { autoComplete: "new-password" } }}
            />
          )}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 2 }}>
        <Button type="submit" variant="contained" size="large">
          Review and install
        </Button>
        <Button size="large" onClick={onBack} sx={{ ml: "auto" }}>
          Back
        </Button>
      </Box>
    </Box>
  );
}
