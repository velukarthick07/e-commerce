"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { useDebounce } from "@/hooks/useDebounce";
import { getList } from "@/services/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CustomerDto, OrderListDto, SearchProductDto } from "@/types/models";
import { formatMoney } from "@/lib/format";

interface Option {
  group: "Products" | "Customers" | "Orders";
  id: string;
  label: string;
  caption: string;
  href: string;
}

/** Searches products, customers and orders at once from the topbar. */
export function GlobalSearch() {
  const router = useRouter();
  const { can } = useAuth();
  const [input, setInput] = useState("");
  // Results carry the query they came from, so `loading` is derived rather
  // than set synchronously inside the effect.
  const [results, setResults] = useState<{ query: string; options: Option[] }>({
    query: "",
    options: [],
  });
  const query = useDebounce(input, 300);

  const searchable = query.trim().length >= 2;
  const loading = searchable && results.query !== query;
  const options = results.query === query ? results.options : [];

  useEffect(() => {
    let cancelled = false;

    if (!searchable) {
      return;
    }

    void (async () => {
      const results: Option[] = [];

      const tasks: Promise<void>[] = [];

      if (can("products:read")) {
        tasks.push(
          getList<SearchProductDto>("/products/search", { q: query, limit: 5 })
            .then(({ data }) => {
              data.forEach((p) =>
                results.push({
                  group: "Products",
                  id: p.id,
                  label: p.name,
                  caption: `${p.sku} · ${p.variants.length} variant${p.variants.length === 1 ? "" : "s"}`,
                  href: `/products/${p.id}`,
                })
              );
            })
            .catch(() => undefined)
        );
      }

      if (can("customers:read")) {
        tasks.push(
          getList<CustomerDto>("/customers/search", { q: query, limit: 5 })
            .then(({ data }) => {
              data.forEach((c) =>
                results.push({
                  group: "Customers",
                  id: c.id,
                  label: c.name,
                  caption: c.phone,
                  href: `/customers/${c.id}`,
                })
              );
            })
            .catch(() => undefined)
        );
      }

      if (can("orders:read")) {
        tasks.push(
          getList<OrderListDto>("/orders", { search: query, limit: 5 })
            .then(({ data }) => {
              data.forEach((o) =>
                results.push({
                  group: "Orders",
                  id: o.id,
                  label: o.orderNumber,
                  caption: `${o.customerName} · ${formatMoney(o.grandTotal)}`,
                  href: `/orders/${o.id}`,
                })
              );
            })
            .catch(() => undefined)
        );
      }

      await Promise.all(tasks);
      if (!cancelled) setResults({ query, options: results });
    })();

    return () => {
      cancelled = true;
    };
  }, [query, searchable, can]);

  const icons = useMemo(
    () => ({
      Products: <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />,
      Customers: <PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />,
      Orders: <ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />,
    }),
    []
  );

  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      size="small"
      options={options}
      groupBy={(option) => option.group}
      filterOptions={(x) => x}
      loading={loading}
      inputValue={input}
      onInputChange={(_, value) => setInput(value)}
      onChange={(_, value) => {
        if (value && typeof value !== "string") {
          router.push(value.href);
          setInput("");
        }
      }}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
      noOptionsText={query.length < 2 ? "Type to search…" : "No matches found"}
      sx={{ width: { xs: "100%", sm: 320, md: 420 } }}
      renderOption={(props, option) => {
        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
        return (
          <Box component="li" key={key} {...rest} sx={{ gap: 1.5 }}>
            <Box sx={{ color: "text.secondary", display: "flex" }}>{icons[option.group]}</Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                {option.label}
              </Typography>
              <Typography variant="caption" noWrap>
                {option.caption}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search products, customers, orders…"
          aria-label="Global search"
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "rgba(255,255,255,0.16)",
              color: "#fff",
              "& fieldset": { borderColor: "rgba(255,255,255,0.28)" },
              "&:hover fieldset": { borderColor: "rgba(255,255,255,0.45)" },
              "&.Mui-focused fieldset": { borderColor: "#fff" },
            },
            "& input::placeholder": { color: "rgba(255,255,255,0.75)", opacity: 1 },
          }}
          slotProps={{
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 19, color: "rgba(255,255,255,0.85)" }} />
                </InputAdornment>
              ),
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} sx={{ color: "#fff" }} />
                </InputAdornment>
              ) : (
                params.slotProps.input.endAdornment
              ),
            },
          }}
        />
      )}
    />
  );
}
