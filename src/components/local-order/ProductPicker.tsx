"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import { useDebounce } from "@/hooks/useDebounce";
import { getList, getOne, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";
import { EmptyState } from "@/components/common/EmptyState";
import { formatMoney } from "@/lib/format";
import type { CategoryDto, SearchProductDto, VariantDto } from "@/types/models";

export interface PickedVariant {
  variant: VariantDto;
  product: { id: string; name: string; unit: string; images: string[] };
}

/** Flattens products into individually addable variants. */
function flatten(products: SearchProductDto[]): PickedVariant[] {
  return products.flatMap((product) =>
    product.variants
      .filter((v) => v.isActive)
      .map((variant) => ({
        variant,
        product: {
          id: product.id,
          name: product.name,
          unit: product.unit,
          images: product.images,
        },
      }))
  );
}

export function ProductPicker({
  onAdd,
  cartQuantities,
}: {
  onAdd: (picked: PickedVariant) => void;
  cartQuantities: Record<string, number>;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [scanning, setScanning] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const query = useDebounce(search, 300);

  useEffect(() => {
    void getList<CategoryDto>("/categories/tree", { activeOnly: true })
      .then(({ data }) => setCategories(data))
      .catch(() => undefined);
  }, []);

  // Results carry the request they belong to, so `loading` is derived.
  const requestKey = `${query}|${categoryId}`;
  const [results, setResults] = useState<{ key: string; data: SearchProductDto[] } | null>(null);

  const loading = results?.key !== requestKey;
  const products = useMemo(
    () => (results?.key === requestKey ? results.data : []),
    [results, requestKey]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getList<SearchProductDto>("/products/search", {
          q: query,
          categoryId: categoryId === "all" ? undefined : categoryId,
          limit: 40,
        });
        if (!cancelled) setResults({ key: requestKey, data });
      } catch {
        if (!cancelled) setResults({ key: requestKey, data: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, categoryId, requestKey]);

  const options = useMemo(() => flatten(products), [products]);

  /** A scanner types the code then presses Enter — resolve and add directly. */
  const handleScan = async (value: string) => {
    const code = value.trim();
    if (!code) return;
    setScanning(true);
    try {
      const variant = await getOne<VariantDto & { product: { id: string; name: string; unit: string; images: string[] } }>(
        "/products/barcode",
        { barcode: code }
      );
      onAdd({ variant, product: variant.product });
      toast.success(`${variant.product.name} (${variant.name}) added`);
      setBarcode("");
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : `No product matches "${code}"`
      );
      setBarcode("");
    } finally {
      setScanning(false);
      barcodeRef.current?.focus();
    }
  };

  return (
    <Box>
      {/* Barcode first — it is the fastest path at the counter */}
      <TextField
        inputRef={barcodeRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleScan(barcode);
          }
        }}
        placeholder="Scan barcode or type SKU, then press Enter"
        aria-label="Scan barcode"
        sx={{ mb: 1.5 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <QrCodeScannerIcon sx={{ fontSize: 20, color: "primary.main" }} />
              </InputAdornment>
            ),
            endAdornment: scanning ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : null,
          },
        }}
      />

      <Autocomplete<PickedVariant>
        options={options}
        loading={loading}
        filterOptions={(x) => x}
        inputValue={search}
        onInputChange={(_, value, reason) => {
          if (reason !== "reset") setSearch(value);
        }}
        value={null}
        onChange={(_, value) => {
          if (value) {
            onAdd(value);
            setSearch("");
          }
        }}
        getOptionLabel={(option) => `${option.product.name} ${option.variant.name}`}
        isOptionEqualToValue={(a, b) => a.variant.id === b.variant.id}
        noOptionsText="No products found"
        blurOnSelect
        sx={{ mb: 2 }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
          const stock = option.variant.inventory?.currentStock ?? 0;
          return (
            <Box component="li" key={key} {...rest} sx={{ gap: 1.5 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                  {option.product.name}
                </Typography>
                <Typography variant="caption">
                  {option.variant.name} · {option.variant.sku}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                  {formatMoney(option.variant.discountPrice ?? option.variant.sellingPrice)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: stock <= 0 ? "error.main" : "text.secondary" }}
                >
                  {stock} in stock
                </Typography>
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search by product name, SKU or brand"
            aria-label="Search products"
            slotProps={{
              input: {
                ...params.slotProps.input,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 19, color: "text.secondary" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />

      {/* Category rail */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Chip
          label="All"
          onClick={() => setCategoryId("all")}
          color={categoryId === "all" ? "primary" : "default"}
          variant={categoryId === "all" ? "filled" : "outlined"}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            onClick={() => setCategoryId(category.id)}
            color={categoryId === category.id ? "primary" : "default"}
            variant={categoryId === category.id ? "filled" : "outlined"}
          />
        ))}
      </Box>

      {/* Tap-to-add grid */}
      {loading ? (
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={88} />
          ))}
        </Box>
      ) : options.length === 0 ? (
        <EmptyState
          compact
          title="No products match"
          description="Try a different search term or category."
        />
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            maxHeight: { md: 460 },
            overflowY: { md: "auto" },
            pr: { md: 0.5 },
          }}
        >
          {options.map((option) => {
            const stock = option.variant.inventory?.currentStock ?? 0;
            const inCart = cartQuantities[option.variant.id] ?? 0;
            const soldOut = stock <= 0;
            const atLimit = inCart >= stock;

            return (
              <Tooltip
                key={option.variant.id}
                title={soldOut ? "Out of stock" : atLimit ? "All available stock is in the cart" : ""}
                disableHoverListener={!soldOut && !atLimit}
              >
                <Box
                  component="button"
                  type="button"
                  disabled={soldOut || atLimit}
                  onClick={() => onAdd(option)}
                  sx={{
                    textAlign: "left",
                    p: 1.5,
                    border: 1,
                    borderColor: inCart > 0 ? "primary.main" : "divider",
                    bgcolor: inCart > 0 ? "primary.light" : "#fff",
                    borderRadius: 2.5,
                    cursor: soldOut || atLimit ? "not-allowed" : "pointer",
                    opacity: soldOut ? 0.55 : 1,
                    font: "inherit",
                    transition: "all .12s",
                    "&:hover:not(:disabled)": {
                      borderColor: "primary.main",
                      transform: "translateY(-1px)",
                      boxShadow: "0 4px 12px rgba(127,86,217,.14)",
                    },
                  }}
                >
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }} noWrap>
                    {option.product.name}
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block", mb: 0.75 }} noWrap>
                    {option.variant.name}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "primary.main" }}>
                      {formatMoney(option.variant.discountPrice ?? option.variant.sellingPrice)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: soldOut ? "error.main" : stock <= 5 ? "warning.main" : "text.secondary" }}
                    >
                      {inCart > 0 ? `${inCart} in cart` : `${stock} left`}
                    </Typography>
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
