"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import TableSortLabel from "@mui/material/TableSortLabel";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortable?: boolean;
  /** Hidden on small screens; the card layout still shows it. */
  secondary?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: string, order: "asc" | "desc") => void;
  onRowClick?: (row: T) => void;
  /** Rendered as the card heading on mobile. */
  mobileTitle?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  emptyAction,
  page = 1,
  limit = 20,
  total = 0,
  onPageChange,
  onLimitChange,
  sortBy,
  sortOrder = "desc",
  onSortChange,
  onRowClick,
  mobileTitle,
}: DataTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const showPagination = !!onPageChange && total > 0;

  if (error) {
    return (
      <Card>
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      </Card>
    );
  }

  // --- Loading ------------------------------------------------------------
  if (loading) {
    return (
      <Card>
        {isMobile ? (
          <Box sx={{ p: 2, display: "grid", gap: 1.5 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={92} />
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key} align={column.align}>
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        <Skeleton width={column.key === "actions" ? 60 : "78%"} height={22} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    );
  }

  // --- Empty --------------------------------------------------------------
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </Card>
    );
  }

  // --- Mobile card layout -------------------------------------------------
  if (isMobile) {
    return (
      <Box>
        <Box sx={{ display: "grid", gap: 1.5 }}>
          {rows.map((row) => (
            <Card
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={{
                p: 2,
                cursor: onRowClick ? "pointer" : "default",
                "&:active": onRowClick ? { bgcolor: "#FCFBFE" } : undefined,
              }}
            >
              {mobileTitle && (
                <Box sx={{ mb: 1.25, fontWeight: 600, fontSize: 15 }}>
                  {mobileTitle(row)}
                </Box>
              )}
              <Box sx={{ display: "grid", gap: 0.75 }}>
                {columns
                  .filter((c) => c.key !== "actions")
                  .map((column) => (
                    <Box
                      key={column.key}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ flexShrink: 0, fontWeight: 500 }}
                      >
                        {column.label}
                      </Typography>
                      <Box sx={{ fontSize: 14, textAlign: "right", minWidth: 0 }}>
                        {column.render
                          ? column.render(row)
                          : String((row as Record<string, unknown>)[column.key] ?? "—")}
                      </Box>
                    </Box>
                  ))}
              </Box>

              {columns.some((c) => c.key === "actions") && (
                <Box
                  sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {columns.find((c) => c.key === "actions")?.render?.(row)}
                </Box>
              )}
            </Card>
          ))}
        </Box>

        {showPagination && (
          <Card sx={{ mt: 1.5 }}>
            <Pagination
              page={page}
              limit={limit}
              total={total}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
            />
          </Card>
        )}
      </Box>
    );
  }

  // --- Desktop table ------------------------------------------------------
  return (
    <Card>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align}
                  sx={{ width: column.width, whiteSpace: "nowrap" }}
                  sortDirection={sortBy === column.key ? sortOrder : false}
                >
                  {column.sortable && onSortChange ? (
                    <TableSortLabel
                      active={sortBy === column.key}
                      direction={sortBy === column.key ? sortOrder : "asc"}
                      onClick={() =>
                        onSortChange(
                          column.key,
                          sortBy === column.key && sortOrder === "asc" ? "desc" : "asc"
                        )
                      }
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                hover={!!onRowClick}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{ cursor: onRowClick ? "pointer" : "default" }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    onClick={
                      column.key === "actions" ? (e) => e.stopPropagation() : undefined
                    }
                  >
                    {column.render
                      ? column.render(row)
                      : String((row as Record<string, unknown>)[column.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {showPagination && (
        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      )}
    </Card>
  );
}

function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}) {
  return (
    <TablePagination
      component="div"
      count={total}
      page={Math.max(0, page - 1)}
      rowsPerPage={limit}
      onPageChange={(_, next) => onPageChange?.(next + 1)}
      onRowsPerPageChange={(e) => onLimitChange?.(Number(e.target.value))}
      rowsPerPageOptions={[10, 20, 50, 100]}
      labelRowsPerPage="Rows"
      sx={{ borderTop: 1, borderColor: "divider" }}
    />
  );
}
