"use client";

import { useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useDebounce } from "@/hooks/useDebounce";
import { getList } from "@/services/api/client";
import { formatMoney, initials } from "@/lib/format";
import { NewCustomerDialog } from "./NewCustomerDialog";
import type { CustomerDto } from "@/types/models";

export function CustomerPicker({
  customer,
  onChange,
}: {
  customer: CustomerDto | null;
  onChange: (customer: CustomerDto | null) => void;
}) {
  const [input, setInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const query = useDebounce(input, 300);

  // Results are tagged with the query they came from, so `loading` is derived
  // rather than set synchronously inside the effect.
  const [results, setResults] = useState<{ query: string; data: CustomerDto[] } | null>(null);
  const loading = results?.query !== query;
  const options = results?.query === query ? results.data : [];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await getList<CustomerDto>("/customers/search", {
          q: query,
          limit: 15,
        });
        if (!cancelled) setResults({ query, data });
      } catch {
        if (!cancelled) setResults({ query, data: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (customer) {
    const address = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          border: 1,
          borderColor: "primary.main",
          bgcolor: "primary.light",
          borderRadius: 2.5,
        }}
      >
        <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
          {initials(customer.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 600, fontSize: 15 }} noWrap>
              {customer.name}
            </Typography>
            {customer.totalOrders > 0 && (
              <Chip
                size="small"
                label={`${customer.totalOrders} orders · ${formatMoney(customer.totalSpent)}`}
                sx={{ bgcolor: "#fff", fontWeight: 500 }}
              />
            )}
          </Box>
          <Typography variant="caption" noWrap sx={{ display: "block" }}>
            {customer.phone}
            {address ? ` · ${address.line1}, ${address.city}` : ""}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => onChange(null)} aria-label="Change customer">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Autocomplete<CustomerDto>
          sx={{ flex: 1 }}
          options={options}
          loading={loading}
          filterOptions={(x) => x}
          inputValue={input}
          onInputChange={(_, value) => setInput(value)}
          onChange={(_, value) => onChange(value)}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          noOptionsText="No customers found — add a new one"
          renderOption={(props, option) => {
            const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & {
              key: string;
            };
            return (
              <Box component="li" key={key} {...rest} sx={{ gap: 1.5 }}>
                <Avatar sx={{ width: 30, height: 30, bgcolor: "primary.light", color: "primary.main", fontSize: 12 }}>
                  {initials(option.name)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                    {option.name}
                  </Typography>
                  <Typography variant="caption">
                    {option.phone} · {option.totalOrders} orders
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search customer by name or phone"
              slotProps={{
                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={16} /> : null}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        <Button
          variant="outlined"
          onClick={() => setDialogOpen(true)}
          startIcon={<PersonAddAltOutlinedIcon />}
          sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
        >
          New
        </Button>
      </Box>

      <NewCustomerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={onChange}
        initialPhone={/^\d+$/.test(input) ? input : ""}
      />
    </>
  );
}
