"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { SetupError, testDatabase } from "@/services/api/setup";
import type { DatabaseFormValues, ServerReport } from "@/types/setup";

const schema = z.object({
  host: z.string().trim().min(1, "Host is required"),
  port: z.coerce.number().int("Enter a port number").min(1).max(65535),
  user: z.string().trim().min(1, "User is required"),
  password: z.string(),
  database: z
    .string()
    .trim()
    .min(1, "Database name is required")
    .max(63, "Database names are limited to 63 characters")
    .regex(
      /^[A-Za-z_][A-Za-z0-9_$]*$/,
      "Start with a letter or underscore, then letters, numbers or underscores"
    ),
  ssl: z.boolean(),
});

type FormValues = z.input<typeof schema>;

interface Props {
  defaultValues: DatabaseFormValues;
  setupKey: string;
  keyRequired: boolean;
  onKeyChange: (key: string) => void;
  onBack: () => void;
  onContinue: (values: DatabaseFormValues) => void;
}

export function DatabaseStep({
  defaultValues,
  setupKey,
  keyRequired,
  onKeyChange,
  onBack,
  onContinue,
}: Props) {
  const [report, setReport] = useState<ServerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Any edit invalidates the previous result, so "Continue" can never be
  // reached with settings that were never actually tested.
  const invalidate = () => {
    if (report) setReport(null);
    if (error) setError(null);
  };

  const onTest = handleSubmit(async (values) => {
    setTesting(true);
    setError(null);
    setReport(null);
    try {
      const result = await testDatabase({
        key: setupKey || undefined,
        database: { ...values, port: Number(values.port) },
      });
      setReport(result);
    } catch (err) {
      setError(err instanceof SetupError ? err.message : "Could not reach the database.");
    } finally {
      setTesting(false);
    }
  });

  const proceed = () => {
    const values = getValues();
    onContinue({ ...values, port: Number(values.port) } as DatabaseFormValues);
  };

  return (
    <Box component="form" onSubmit={onTest} noValidate>
      <Typography variant="h2" sx={{ fontSize: 21, fontWeight: 700, mb: 0.5 }}>
        Database connection
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: 14, mb: 2.5 }}>
        Where PostgreSQL is running, and an account that may connect to it. The
        database itself does not need to exist yet — setup will create it.
      </Typography>

      {keyRequired && (
        <TextField
          label="Setup key"
          value={setupKey}
          onChange={(event) => {
            onKeyChange(event.target.value);
            invalidate();
          }}
          fullWidth
          required
          margin="normal"
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          helperText="Printed in the server console when the application started, and saved in the .setup-key file."
          slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: "characters" } }}
        />
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" },
          gap: 2,
          mt: 1,
        }}
      >
        <Controller
          name="host"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              onChange={(e) => {
                field.onChange(e);
                invalidate();
              }}
              label="Host"
              fullWidth
              error={Boolean(errors.host)}
              helperText={errors.host?.message ?? "localhost, or the address of your database server"}
            />
          )}
        />
        <Controller
          name="port"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              onChange={(e) => {
                field.onChange(e);
                invalidate();
              }}
              label="Port"
              type="number"
              fullWidth
              error={Boolean(errors.port)}
              helperText={errors.port?.message ?? "Usually 5432"}
            />
          )}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
          mt: 1,
        }}
      >
        <Controller
          name="user"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              onChange={(e) => {
                field.onChange(e);
                invalidate();
              }}
              label="User"
              fullWidth
              error={Boolean(errors.user)}
              helperText={errors.user?.message ?? "Needs permission to create a database"}
            />
          )}
        />
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              onChange={(e) => {
                field.onChange(e);
                invalidate();
              }}
              label="Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              error={Boolean(errors.password)}
              helperText={errors.password?.message ?? " "}
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
                        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        />
      </Box>

      <Controller
        name="database"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            onChange={(e) => {
              field.onChange(e);
              invalidate();
            }}
            label="Database name"
            fullWidth
            margin="normal"
            error={Boolean(errors.database)}
            helperText={errors.database?.message ?? "Created if it does not already exist"}
          />
        )}
      />

      <Controller
        name="ssl"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={
              <Checkbox
                checked={field.value}
                onChange={(e) => {
                  field.onChange(e.target.checked);
                  invalidate();
                }}
              />
            }
            label="Connect over SSL"
          />
        )}
      />
      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 2 }}>
        Required by most hosted PostgreSQL providers. The connection is
        encrypted, but the server&apos;s certificate is not verified against a
        certificate authority.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {report && (
        <Alert severity={report.canProceed ? "success" : "error"} sx={{ mb: 2 }}>
          <AlertTitle>{report.canProceed ? "Connected" : "Cannot use this database"}</AlertTitle>
          {report.message}
          {report.canProceed && !report.canCreateDatabase && report.target === "missing" && (
            <Box sx={{ mt: 0.5 }}>This user cannot create databases.</Box>
          )}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button type="submit" variant="outlined" size="large" loading={testing}>
          Test connection
        </Button>
        <Button
          variant="contained"
          size="large"
          disabled={!report?.canProceed}
          onClick={proceed}
        >
          Continue
        </Button>
        <Button size="large" onClick={onBack} sx={{ ml: "auto" }}>
          Back
        </Button>
      </Box>
    </Box>
  );
}
