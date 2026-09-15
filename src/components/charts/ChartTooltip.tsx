"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface Entry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Shared Recharts tooltip so every chart reads identically. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string;
  formatter?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        px: 1.5,
        py: 1,
        boxShadow: "0 6px 18px rgba(16,24,40,.12)",
      }}
    >
      {label && (
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>{label}</Typography>
      )}
      {payload.map((entry, index) => (
        <Box
          key={index}
          sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 13 }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: entry.color ?? "primary.main",
              flexShrink: 0,
            }}
          />
          <Typography component="span" sx={{ fontSize: 13, color: "text.secondary" }}>
            {entry.name}
          </Typography>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, ml: "auto" }}>
            {formatter
              ? formatter(Number(entry.value ?? 0), String(entry.dataKey ?? ""))
              : String(entry.value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
