"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "medium",
  removable = false,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  size?: "small" | "medium";
  /** Show a bin icon instead of "−" when decrementing would empty the line. */
  removable?: boolean;
}) {
  const compact = size === "small";
  const atMax = value >= max;

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        border: 1,
        borderColor: "primary.main",
        borderRadius: 2,
        overflow: "hidden",
        height: compact ? 34 : 40,
      }}
    >
      <IconButton
        size="small"
        onClick={() => onChange(value - 1)}
        aria-label={value === 1 && removable ? "Remove from cart" : "Decrease quantity"}
        sx={{ borderRadius: 0, color: "primary.main", height: "100%" }}
      >
        {value === 1 && removable ? (
          <DeleteOutlinedIcon fontSize="small" />
        ) : (
          <RemoveIcon fontSize="small" />
        )}
      </IconButton>

      <Typography
        sx={{
          minWidth: compact ? 28 : 34,
          textAlign: "center",
          fontWeight: 600,
          fontSize: compact ? 13 : 14,
          userSelect: "none",
        }}
      >
        {value}
      </Typography>

      <IconButton
        size="small"
        disabled={atMax}
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        title={atMax ? `Only ${max} left in stock` : undefined}
        sx={{ borderRadius: 0, color: "primary.main", height: "100%" }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
