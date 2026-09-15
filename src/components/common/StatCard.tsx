"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

export function StatCard({
  label,
  value,
  icon,
  change,
  comparison,
  loading = false,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  comparison?: string;
  loading?: boolean;
  accent?: "primary" | "success" | "warning" | "error" | "info";
}) {
  const hasChange = typeof change === "number" && Number.isFinite(change);
  const positive = (change ?? 0) >= 0;

  return (
    <Card sx={{ p: 2.5, height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }} noWrap>
            {label}
          </Typography>

          {loading ? (
            <Skeleton width={110} height={34} />
          ) : (
            <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
              {value}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            bgcolor: (t) =>
              accent === "primary" ? t.palette.primary.light : `${t.palette[accent].main}1A`,
            color: (t) => t.palette[accent].main,
            "& svg": { fontSize: 21 },
          }}
        >
          {icon}
        </Box>
      </Box>

      {(hasChange || comparison) && !loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}>
          {hasChange && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.25,
                px: 0.75,
                py: 0.25,
                borderRadius: 1.5,
                bgcolor: (t) =>
                  `${positive ? t.palette.success.main : t.palette.error.main}14`,
                color: positive ? "success.main" : "error.main",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {positive ? (
                <ArrowUpwardIcon sx={{ fontSize: 13 }} />
              ) : (
                <ArrowDownwardIcon sx={{ fontSize: 13 }} />
              )}
              {Math.abs(change ?? 0).toFixed(1)}%
            </Box>
          )}
          {comparison && (
            <Typography variant="caption" noWrap>
              {comparison}
            </Typography>
          )}
        </Box>
      )}
    </Card>
  );
}
