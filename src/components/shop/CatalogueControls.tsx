"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { ShopCategory } from "@/types/shop";

const SORTS = [
  { value: "relevance", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
];

/**
 * Filters are held in the URL rather than component state, so a filtered view
 * can be shared, bookmarked and rendered on the server.
 */
export function CatalogueControls({
  categories,
  total,
}: {
  categories: ShopCategory[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const categoryId = params.get("categoryId") ?? "";
  const sort = params.get("sort") ?? "relevance";
  const inStockOnly = params.get("inStockOnly") === "true";
  const search = params.get("search") ?? "";

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any filter change invalidates the current page number.
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const flat = categories.flatMap((parent) => [
    { id: parent.id, name: parent.name, count: parent.productCount, depth: 0 },
    ...parent.children.map((child) => ({
      id: child.id,
      name: child.name,
      count: child.productCount,
      depth: 1,
    })),
  ]);

  return (
    <Stack spacing={2}>
      {/* Category pills scroll sideways on phones instead of wrapping into a
          wall of chips. */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          overflowX: "auto",
          pb: 0.5,
          "&::-webkit-scrollbar": { height: 6 },
        }}
      >
        <Chip
          label="All products"
          color={categoryId ? "default" : "primary"}
          variant={categoryId ? "outlined" : "filled"}
          onClick={() => apply({ categoryId: null })}
          sx={{ flexShrink: 0 }}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={`${category.name} (${category.productCount})`}
            color={categoryId === String(category.id) ? "primary" : "default"}
            variant={categoryId === String(category.id) ? "filled" : "outlined"}
            onClick={() => apply({ categoryId: String(category.id) })}
            sx={{ flexShrink: 0 }}
          />
        ))}
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Typography variant="body2" color="text.secondary">
          {total} product{total === 1 ? "" : "s"}
          {search ? (
            <>
              {" "}
              for <strong>“{search}”</strong> ·{" "}
              <Box
                component={Link}
                href={pathname}
                sx={{ color: "primary.main", textDecoration: "none" }}
              >
                clear
              </Box>
            </>
          ) : null}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={inStockOnly}
                onChange={(e) => apply({ inStockOnly: e.target.checked ? "true" : null })}
              />
            }
            label={<Typography variant="body2">In stock only</Typography>}
            sx={{ mr: 0 }}
          />

          <TextField
            select
            size="small"
            value={categoryId}
            onChange={(e) => apply({ categoryId: e.target.value || null })}
            sx={{ minWidth: 150, display: { xs: "block", md: "none" } }}
          >
            <MenuItem value="">All categories</MenuItem>
            {flat.map((c) => (
              <MenuItem key={c.id} value={String(c.id)} sx={{ pl: c.depth ? 3 : 2 }}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            value={sort}
            onChange={(e) => apply({ sort: e.target.value })}
            sx={{ minWidth: 168 }}
          >
            {SORTS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
    </Stack>
  );
}
