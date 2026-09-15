"use client";

import { createTheme, alpha } from "@mui/material/styles";
import { brand } from "./palette";

const RADIUS = 10;

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: {
      main: brand.primary,
      dark: brand.primaryDark,
      light: brand.primaryLight,
      contrastText: brand.white,
    },
    success: { main: brand.success, contrastText: brand.white },
    warning: { main: brand.warning, contrastText: brand.white },
    error: { main: brand.error, contrastText: brand.white },
    info: { main: brand.info, contrastText: brand.white },
    background: { default: brand.background, paper: brand.white },
    text: { primary: brand.textPrimary, secondary: brand.textSecondary },
    divider: brand.border,
  },

  shape: { borderRadius: RADIUS },

  typography: {
    fontFamily: "var(--font-inter), Inter, system-ui, -apple-system, sans-serif",
    h1: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontSize: 22, fontWeight: 600 },
    h4: { fontSize: 18, fontWeight: 600 },
    h5: { fontSize: 16, fontWeight: 600 },
    h6: { fontSize: 15, fontWeight: 600 },
    subtitle1: { fontSize: 15, fontWeight: 500 },
    subtitle2: { fontSize: 13, fontWeight: 600, color: brand.textSecondary },
    body1: { fontSize: 15, fontWeight: 400 },
    body2: { fontSize: 14, fontWeight: 400 },
    caption: { fontSize: 12.5, color: brand.textSecondary },
    button: { fontSize: 14, fontWeight: 600, textTransform: "none" },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*": { boxSizing: "border-box" },
        body: { backgroundColor: brand.background },
        // Subtle, consistent scrollbars across the app
        "::-webkit-scrollbar": { width: 10, height: 10 },
        "::-webkit-scrollbar-thumb": {
          backgroundColor: "#D4D0DC",
          borderRadius: 8,
          border: "2px solid transparent",
          backgroundClip: "content-box",
        },
        "::-webkit-scrollbar-thumb:hover": { backgroundColor: "#B9B3C6" },
      },
    },

    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { border: `1px solid ${brand.border}` },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0, variant: "outlined" },
      styleOverrides: {
        root: {
          border: `1px solid ${brand.border}`,
          borderRadius: 14,
          boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: "18px 20px 4px" },
        title: { fontSize: 16, fontWeight: 600 },
        subheader: { fontSize: 13, color: brand.textSecondary },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 20, "&:last-child": { paddingBottom: 20 } },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: RADIUS, paddingInline: 16, minHeight: 40 },
        sizeSmall: { minHeight: 34, paddingInline: 12, fontSize: 13 },
        sizeLarge: { minHeight: 46, fontSize: 15 },
        outlined: { borderColor: brand.border },
      },
    },

    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },

    MuiTextField: {
      defaultProps: { size: "small", fullWidth: true },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          backgroundColor: brand.white,
          "& fieldset": { borderColor: brand.border },
          "&:hover fieldset": { borderColor: "#CFC8DD" },
          "&.Mui-focused fieldset": {
            borderColor: brand.primary,
            borderWidth: 1.5,
          },
        },
        input: { fontSize: 14 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, fontSize: 12 } } },

    MuiSelect: { defaultProps: { size: "small" } },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 7, fontWeight: 600, fontSize: 12 },
        sizeSmall: { height: 24 },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: brand.border, fontSize: 14 },
        head: {
          fontWeight: 600,
          fontSize: 12.5,
          color: brand.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          backgroundColor: "#FAFAFC",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&:hover": { backgroundColor: "#FCFBFE" } },
      },
    },

    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 16 } },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: 18, fontWeight: 600, padding: "20px 24px 8px" } },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: "8px 24px" } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "16px 24px 20px", gap: 8 } } },

    MuiDrawer: {
      styleOverrides: { paper: { borderRight: `1px solid ${brand.border}` } },
    },

    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundColor: brand.primary } },
    },

    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44, borderBottom: `1px solid ${brand.border}` },
        indicator: { height: 2.5, borderRadius: 2 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: "none",
          fontWeight: 600,
          fontSize: 14,
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12, borderRadius: 8, backgroundColor: "#27272A" },
      },
    },

    MuiAlert: {
      styleOverrides: { root: { borderRadius: RADIUS, fontSize: 14 } },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS,
          "&.Mui-selected": {
            backgroundColor: brand.primaryLight,
            color: brand.primary,
            "&:hover": { backgroundColor: alpha(brand.primary, 0.14) },
            "& .MuiListItemIcon-root": { color: brand.primary },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 38, color: brand.textSecondary } },
    },

    MuiSkeleton: {
      styleOverrides: { root: { borderRadius: 8, backgroundColor: "#EFEDF4" } },
    },

    MuiAvatar: {
      styleOverrides: { root: { fontSize: 14, fontWeight: 600 } },
    },
  },
});

export default theme;
