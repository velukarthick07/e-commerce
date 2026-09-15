"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { post, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await post<{ message: string }>("/auth/reset-password", {
        token,
        ...values,
      });
      toast.success(result.data.message);
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset your password.");
    }
  });

  if (!token) {
    return (
      <Box>
        <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
          Invalid link
        </Typography>
        <Alert severity="error" sx={{ mb: 3 }}>
          This password reset link is missing its token. Request a new one.
        </Alert>
        <Button component={Link} href="/forgot-password" variant="contained" fullWidth>
          Request a new link
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
        Set a new password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
        Choose a password with at least 8 characters, including a letter and a number.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      <TextField
        {...register("password")}
        label="New password"
        type="password"
        autoFocus
        error={!!errors.password}
        helperText={errors.password?.message}
        sx={{ mb: 2.5 }}
      />
      <TextField
        {...register("confirmPassword")}
        label="Confirm new password"
        type="password"
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
        sx={{ mb: 3 }}
      />

      <Button type="submit" variant="contained" size="large" fullWidth loading={isSubmitting}>
        Reset password
      </Button>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
