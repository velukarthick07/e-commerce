"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { post, ApiError } from "@/services/api/client";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<{ message: string; resetToken?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await post<{ message: string; resetToken?: string }>(
        "/auth/forgot-password",
        values
      );
      setSent(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send the reset link.");
    }
  });

  if (sent) {
    return (
      <Box>
        <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
          Check your email
        </Typography>
        <Alert severity="success" sx={{ mb: 3 }}>
          {sent.message}
        </Alert>

        {sent.resetToken && (
          <Alert severity="info" sx={{ mb: 3, wordBreak: "break-all" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
              Development mode — no email provider configured
            </Typography>
            <Link href={`/reset-password?token=${sent.resetToken}`}>
              <Typography sx={{ fontSize: 13, color: "primary.main", fontWeight: 600 }}>
                Open the reset link →
              </Typography>
            </Link>
          </Alert>
        )}

        <Button component={Link} href="/login" startIcon={<ArrowBackIcon />} fullWidth>
          Back to sign in
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
        Forgot password?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
        Enter the email on your account and we will send you a reset link.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      <TextField
        {...register("email")}
        label="Email"
        type="email"
        autoFocus
        error={!!errors.email}
        helperText={errors.email?.message}
        sx={{ mb: 3 }}
      />

      <Button type="submit" variant="contained" size="large" fullWidth loading={isSubmitting}>
        Send reset link
      </Button>

      <Button component={Link} href="/login" startIcon={<ArrowBackIcon />} fullWidth sx={{ mt: 1.5 }}>
        Back to sign in
      </Button>
    </Box>
  );
}
