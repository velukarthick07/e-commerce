"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { ButtonProps } from "@mui/material/Button";
import type { SxProps, Theme } from "@mui/material/styles";

/**
 * `component={Link}` passes a component *function* as a prop, which a Server
 * Component may not do — React can only send serialisable props across that
 * boundary. Binding happens here instead, inside a Client Component, so the
 * server-rendered shop pages can still link with client-side navigation.
 */
export function LinkButton({
  href,
  children,
  ...props
}: { href: string; children: React.ReactNode } & Omit<ButtonProps, "href">) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  );
}

export function TextLink({
  href,
  children,
  sx,
  muted = false,
}: {
  href: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  muted?: boolean;
}) {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        color: muted ? "text.secondary" : "primary.main",
        textDecoration: "none",
        "&:hover": { color: "primary.main" },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
