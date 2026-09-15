"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api/client";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "superadmin@fmcg.local", password: "SuperAdmin@123" },
  { role: "Manager", email: "manager@fmcg.local", password: "Manager@123" },
  { role: "Staff", email: "staff@fmcg.local", password: "Staff@123" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "Unable to sign in. Please try again."
      );
    }
  });

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
        Sign in
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
        Welcome back. Enter your details to continue.
      </Typography>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {serverError}
        </Alert>
      )}

      {/* Controlled so MUI always sees the value — an uncontrolled field
          filled by setValue (the demo buttons) would leave the floating
          label sitting on top of the text. */}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            {...field}
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            error={!!errors.email}
            helperText={errors.email?.message}
            sx={{ mb: 2.5 }}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            {...field}
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <VisibilityOffOutlinedIcon fontSize="small" />
                      ) : (
                        <VisibilityOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5, mb: 3 }}>
        <Link href="/forgot-password">
          <Typography sx={{ fontSize: 13.5, color: "primary.main", fontWeight: 600 }}>
            Forgot password?
          </Typography>
        </Link>
      </Box>

      <Button type="submit" variant="contained" size="large" fullWidth loading={isSubmitting}>
        Sign in
      </Button>

      <Divider sx={{ my: 3.5 }}>
        <Typography variant="caption">Demo accounts</Typography>
      </Divider>

      <Box sx={{ display: "grid", gap: 1 }}>
        {DEMO_ACCOUNTS.map((account) => (
          <Button
            key={account.email}
            variant="outlined"
            size="small"
            onClick={() => {
              setValue("email", account.email, { shouldValidate: true });
              setValue("password", account.password, { shouldValidate: true });
              setServerError(null);
            }}
            sx={{ justifyContent: "space-between", fontWeight: 500, color: "text.primary" }}
          >
            <span>{account.role}</span>
            <Typography variant="caption" component="span">
              {account.email}
            </Typography>
          </Button>
        ))}
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
