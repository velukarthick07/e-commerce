"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";

/**
 * The code is only ever *proposed* here — whether it is valid, in date and
 * within its usage limit is decided by the pricing endpoint, and the error it
 * returns is what gets shown.
 */
export function CouponField({
  applied,
  error,
  onApply,
  onClear,
}: {
  applied: string | null;
  error: string | null;
  onApply: (code: string) => void;
  onClear: () => void;
}) {
  const [code, setCode] = useState("");

  if (applied) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Chip
          icon={<LocalOfferOutlinedIcon />}
          color="success"
          variant="outlined"
          label={`${applied} applied`}
          onDelete={onClear}
          sx={{ fontWeight: 600 }}
        />
      </Stack>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = code.trim().toUpperCase();
        if (value) onApply(value);
      }}
    >
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          fullWidth
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Coupon code"
          error={Boolean(error)}
          slotProps={{ htmlInput: { style: { textTransform: "uppercase" } } }}
        />
        <Button type="submit" variant="outlined" disabled={!code.trim()}>
          Apply
        </Button>
      </Stack>
      {error ? (
        <Typography variant="caption" color="error" sx={{ mt: 0.75, display: "block" }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
