"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { NAV_ITEMS } from "./navigation";
import { useAuth } from "@/context/AuthContext";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();

  const visible = NAV_ITEMS.filter(
    (item) => item.permission === null || can(item.permission)
  );

  const [expanded, setExpanded] = useState<string[]>(() =>
    visible.filter((i) => i.children && isActive(pathname, i.href)).map((i) => i.href)
  );

  const toggle = (href: string) =>
    setExpanded((current) =>
      current.includes(href) ? current.filter((h) => h !== href) : [...current, href]
    );

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        height: "100%",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {visible.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const open = expanded.includes(item.href);

          return (
            <Box key={item.href} sx={{ mb: 0.25 }}>
              <ListItemButton
                component={item.children ? "button" : Link}
                href={item.children ? undefined : item.href}
                selected={active}
                onClick={() => {
                  if (item.children) toggle(item.href);
                  else onNavigate?.();
                }}
                sx={{
                  py: 1,
                  width: "100%",
                  textAlign: "left",
                  ...(item.highlight && !active
                    ? { color: "primary.main", "& .MuiListItemIcon-root": { color: "primary.main" } }
                    : {}),
                }}
              >
                <ListItemIcon>
                  <Icon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: { sx: { fontSize: 14, fontWeight: active ? 600 : 500 } },
                  }}
                />
                {item.children && (open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />)}
              </ListItemButton>

              {item.children && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                  <List disablePadding sx={{ pl: 4.5, pt: 0.25 }}>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.href}
                        component={Link}
                        href={child.href}
                        selected={pathname === child.href}
                        onClick={onNavigate}
                        sx={{ py: 0.6, minHeight: 34 }}
                      >
                        <ListItemText
                          primary={child.label}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: 13.5,
                                fontWeight: pathname === child.href ? 600 : 400,
                              },
                            },
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          );
        })}
      </List>

      <Box sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="caption" sx={{ fontSize: 11.5 }}>
          FMCG Admin · v1.0
        </Typography>
      </Box>
    </Box>
  );
}
