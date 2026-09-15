"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { shopApi } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";
import { formatPhone } from "@/lib/phone";
import type { ShopCustomer } from "@/types/shop";

type Step = "phone" | "code";

/**
 * Mobile + OTP sign-in, shared by the login page and checkout.
 *
 * A number with no account yet is not an error: the server asks for a name on
 * the second step and creates the customer as part of verifying. That keeps
 * "sign in" and "sign up" a single flow, which is what shoppers expect from a
 * phone-first checkout.
 */
export function OtpSignIn({
  onSuccess,
  defaultPhone = "",
  lockPhone = false,
  compact = false,
}: {
  onSuccess: (customer: ShopCustomer) => void;
  defaultPhone?: string;
  lockPhone?: boolean;
  compact?: boolean;
}) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function message(err: unknown) {
    return err instanceof ApiError
      ? err.message
      : "Something went wrong. Please try again.";
  }

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await shopApi.requestOtp(phone);
      setDevCode(result.devCode ?? null);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await shopApi.verifyOtp(phone, code, needsName ? name : undefined);
      if ("needsName" in result && result.needsName) {
        setNeedsName(true);
        setError(null);
        return;
      }
      if ("customer" in result) onSuccess(result.customer);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <Box component="form" onSubmit={sendCode}>
        <Stack spacing={2}>
          {!compact ? (
            <Typography color="text.secondary">
              Enter your mobile number and we&apos;ll send you a 6-digit code.
            </Typography>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={lockPhone}
            autoFocus={!lockPhone}
            autoComplete="tel"
            inputMode="numeric"
            fullWidth
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start">+91</InputAdornment>,
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            loading={busy}
            disabled={phone.replace(/\D/g, "").length < 10}
          >
            Send code
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={verify}>
      <Stack spacing={2}>
        <Typography color="text.secondary">
          {needsName
            ? "Almost done — what should we call you?"
            : `We sent a code to ${formatPhone(phone)}.`}
        </Typography>

        {devCode ? (
          <Alert severity="info">
            No SMS gateway is configured in this build, so here is your code:{" "}
            <strong>{devCode}</strong>
          </Alert>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        <TextField
          label="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus={!needsName}
          autoComplete="one-time-code"
          inputMode="numeric"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 6, style: { letterSpacing: ".3em" } } }}
        />

        {needsName ? (
          <TextField
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="name"
            fullWidth
          />
        ) : null}

        <Button
          type="submit"
          variant="contained"
          size="large"
          loading={busy}
          disabled={code.length !== 6 || (needsName && name.trim().length < 2)}
        >
          {needsName ? "Create account & continue" : "Verify"}
        </Button>

        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
          <Button
            size="small"
            onClick={() => {
              setStep("phone");
              setNeedsName(false);
              setError(null);
            }}
            disabled={busy || lockPhone}
          >
            Change number
          </Button>
          <Button size="small" onClick={() => void sendCode()} disabled={busy}>
            Resend code
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
