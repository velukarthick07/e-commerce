"use client";

import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "next/link";
import Typography from "@mui/material/Typography";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 1, "& .MuiBreadcrumbs-li": { fontSize: 13 } }}
        >
          {breadcrumbs.map((crumb) =>
            crumb.href ? (
              <Link key={crumb.label} href={crumb.href}>
                <Typography
                  variant="caption"
                  sx={{ fontSize: 13, "&:hover": { color: "primary.main" } }}
                >
                  {crumb.label}
                </Typography>
              </Link>
            ) : (
              <Typography
                key={crumb.label}
                variant="caption"
                sx={{ fontSize: 13, color: "text.primary", fontWeight: 500 }}
              >
                {crumb.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: 24, md: 30 } }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>

        {actions && (
          <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0, flexWrap: "wrap" }}>
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
}
