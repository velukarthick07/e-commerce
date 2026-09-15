/** Brand tokens from the design spec — the single place colours are defined. */
export const brand = {
  primary: "#7F56D9",
  primaryDark: "#6941C6",
  primaryLight: "#F4F0FF",
  background: "#F8F8FC",
  white: "#FFFFFF",
  textPrimary: "#18181B",
  textSecondary: "#71717A",
  border: "#E4E1EA",
  success: "#12B76A",
  warning: "#F79009",
  error: "#F04438",
  info: "#2E90FA",
} as const;

/** Chart series colours — purple-led, then supporting hues. */
export const chartColors = [
  brand.primary,
  brand.info,
  brand.success,
  brand.warning,
  brand.error,
  "#A78BFA",
  "#22D3EE",
  "#F472B6",
  "#84CC16",
] as const;
