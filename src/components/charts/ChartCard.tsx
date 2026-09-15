"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { EmptyState } from "@/components/common/EmptyState";
import ShowChartIcon from "@mui/icons-material/ShowChart";

export function ChartCard({
  title,
  subtitle,
  action,
  loading,
  isEmpty,
  emptyMessage = "No data for this period yet.",
  height = 300,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h5">{title}</Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Box>

        <Box sx={{ flex: 1, minHeight: height }}>
          {loading ? (
            <Skeleton variant="rounded" height={height} />
          ) : isEmpty ? (
            <EmptyState
              compact
              title="Nothing to chart yet"
              description={emptyMessage}
              icon={<ShowChartIcon />}
            />
          ) : (
            children
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
