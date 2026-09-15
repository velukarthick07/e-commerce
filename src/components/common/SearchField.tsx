"use client";

import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  autoFocus = false,
  sx,
  inputRef,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  sx?: object;
  inputRef?: React.Ref<HTMLInputElement>;
  onEnter?: (value: string) => void;
}) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter(value);
        }
      }}
      placeholder={placeholder}
      autoFocus={autoFocus}
      inputRef={inputRef}
      aria-label={placeholder}
      sx={{ minWidth: { xs: "100%", sm: 260 }, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 19, color: "text.secondary" }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange("")} aria-label="Clear search">
                <ClearIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}
