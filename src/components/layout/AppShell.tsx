"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";
import CircularProgress from "@mui/material/CircularProgress";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { SIDEBAR_WIDTH } from "./navigation";
import { useAuth } from "@/context/AuthContext";
import { getOne } from "@/services/api/client";
import type { StoreSettingsDto } from "@/types/models";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storeName, setStoreName] = useState("FMCG Admin");
  const [alerts, setAlerts] = useState(0);

  // Store name for the topbar, plus a count of stock/expiry alerts.
  useEffect(() => {
    if (!user) return;

    if (can("settings:read")) {
      void getOne<StoreSettingsDto>("/settings")
        .then((s) => setStoreName(s.storeName))
        .catch(() => undefined);
    }

    if (can("inventory:read")) {
      void Promise.all([
        getOne<{ lowStock: number; outOfStock: number }>("/inventory/summary"),
        getOne<{ summary: { bucket: string; batches: number }[] }>("/inventory/expiry", {
          limit: 1,
        }),
      ])
        .then(([stock, expiry]) => {
          const expiringSoon = expiry.summary
            .filter((b) => b.bucket === "expired" || b.bucket === "7_days")
            .reduce((sum, b) => sum + b.batches, 0);
          setAlerts(stock.lowStock + stock.outOfStock + expiringSoon);
        })
        .catch(() => undefined);
    }
  }, [user, can]);

  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Topbar
        onMenuClick={() => setMobileOpen((v) => !v)}
        storeName={storeName}
        alertCount={alerts}
      />

      {/* Permanent sidebar on desktop, drawer on mobile (spec §7, §52) */}
      <Box
        component="aside"
        sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH, boxSizing: "border-box" },
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 60 } }} />
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: SIDEBAR_WIDTH,
              boxSizing: "border-box",
              top: 64,
              height: "calc(100% - 64px)",
            },
          }}
        >
          <Sidebar />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, sm: 2.5, lg: 4 },
          pb: 5,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 60, md: 64 } }} />
        <Box sx={{ pt: 3, maxWidth: 1440, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
