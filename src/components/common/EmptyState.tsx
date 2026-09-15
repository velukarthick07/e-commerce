"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: compact ? 4 : 8,
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          bgcolor: "primary.light",
          color: "primary.main",
          mb: 2,
          "& svg": { fontSize: 28 },
        }}
      >
        {icon ?? <Inventory2OutlinedIcon />}
      </Box>

      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 420, mb: action ? 2.5 : 0 }}
        >
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
