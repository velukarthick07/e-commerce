"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";

/** Consistent wrapper for the filter row above every list page. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <Card sx={{ p: 2, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
        }}
      >
        {children}
      </Box>
    </Card>
  );
}
