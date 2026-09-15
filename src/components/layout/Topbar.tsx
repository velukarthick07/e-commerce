"use client";

import { useState } from "react";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { useAuth } from "@/context/AuthContext";
import { initials } from "@/lib/format";
import { GlobalSearch } from "./GlobalSearch";
import { SIDEBAR_WIDTH } from "./navigation";

export function Topbar({
  onMenuClick,
  storeName,
  alertCount = 0,
}: {
  onMenuClick: () => void;
  storeName: string;
  alertCount?: number;
}) {
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: "primary.main" }}
    >
      <Toolbar sx={{ gap: 2, minHeight: { xs: 60, md: 64 } }}>
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{ color: "#fff", display: { md: "none" } }}
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </IconButton>

        <Box
          component={Link}
          href="/dashboard"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            width: { md: SIDEBAR_WIDTH - 32 },
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <StorefrontIcon sx={{ fontSize: 19, color: "#fff" }} />
          </Box>
          <Typography
            sx={{
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              display: { xs: "none", sm: "block" },
            }}
            noWrap
          >
            {storeName}
          </Typography>
        </Box>

        <Box
          sx={{ flex: 1, display: { xs: "none", sm: "block" }, maxWidth: 460 }}
        >
          <GlobalSearch />
        </Box>

        {/* `ml: auto` pushes the alerts + account cluster to the right edge.
            The search box is capped at 460px, so without this the controls
            would pack against it and leave the right side of the bar empty. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
          <Tooltip title="Stock and expiry alerts">
            <IconButton
              component={Link}
              href="/inventory/expiry"
              sx={{ color: "#fff" }}
              aria-label={`${alertCount} inventory alerts`}
            >
              <Badge badgeContent={alertCount} color="error" max={99}>
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Box
            onClick={(e) => setAnchor(e.currentTarget)}
            role="button"
            tabIndex={0}
            aria-label="Account menu"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setAnchor(e.currentTarget);
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              cursor: "pointer",
              px: 1,
              py: 0.5,
              borderRadius: 2,
              "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
            }}
          >
            <Avatar
              src={user?.avatarUrl ?? undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: "rgba(255,255,255,0.24)",
                color: "#fff",
              }}
            >
              {user ? initials(user.name) : "?"}
            </Avatar>
            <Box sx={{ display: { xs: "none", md: "block" }, lineHeight: 1.2 }}>
              <Typography
                sx={{ color: "#fff", fontSize: 13.5, fontWeight: 600 }}
                noWrap
              >
                {user?.name ?? "—"}
              </Typography>
              <Typography
                sx={{ color: "rgba(255,255,255,0.8)", fontSize: 11.5 }}
                noWrap
              >
                {user?.roleLabel ?? ""}
              </Typography>
            </Box>
            <KeyboardArrowDownIcon
              sx={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 18,
                display: { xs: "none", md: "block" },
              }}
            />
          </Box>
        </Box>

        <Menu
          anchorEl={anchor}
          open={!!anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {user?.name}
            </Typography>
            <Typography variant="caption">{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem
            component={Link}
            href="/settings/profile"
            onClick={() => setAnchor(null)}
          >
            <ListItemIcon>
              <PersonOutlineIcon fontSize="small" />
            </ListItemIcon>
            My profile
          </MenuItem>
          <MenuItem
            component={Link}
            href="/settings"
            onClick={() => setAnchor(null)}
          >
            <ListItemIcon>
              <SettingsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Settings
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setAnchor(null);
              void logout();
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: "error.main" }} />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
