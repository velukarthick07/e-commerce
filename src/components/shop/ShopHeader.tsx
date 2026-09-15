"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { useCart } from "@/hooks/useCart";
import { useShopAuth } from "@/context/ShopAuthContext";
import { initials } from "@/lib/format";
import type { StoreInfo } from "@/types/shop";

const NAV = [
  { label: "Shop", href: "/shop", icon: StorefrontOutlinedIcon },
  { label: "Track order", href: "/shop/track", icon: LocalShippingOutlinedIcon },
];

export function ShopHeader({ store }: { store: StoreInfo }) {
  const router = useRouter();
  const { count } = useCart();
  const { customer, logout } = useShopAuth();

  const [term, setTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = term.trim();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
    setDrawerOpen(false);
  }

  async function handleLogout() {
    setAccountAnchor(null);
    await logout();
    router.push("/shop");
    router.refresh();
  }

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Container maxWidth="lg" disableGutters>
          <Toolbar sx={{ gap: 1.5, px: { xs: 2, sm: 3 }, minHeight: { xs: 62, md: 72 } }}>
            <IconButton
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { md: "none" } }}
              aria-label="Open menu"
            >
              <MenuIcon />
            </IconButton>

            <Box
              component={Link}
              href="/shop"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                textDecoration: "none",
                color: "inherit",
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <StorefrontOutlinedIcon fontSize="small" />
              </Box>
              <Typography
                variant="h5"
                noWrap
                sx={{ fontWeight: 700, display: { xs: "none", sm: "block" }, maxWidth: 220 }}
              >
                {store.storeName}
              </Typography>
            </Box>

            <Box
              component="form"
              onSubmit={submitSearch}
              sx={{ flex: 1, display: { xs: "none", md: "block" }, maxWidth: 440, ml: 2 }}
            >
              <TextField
                size="small"
                fullWidth
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search oils, millets, spices…"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="disabled" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* `ml: auto` anchors the actions to the right edge regardless of
                how wide the search box and store name end up. */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
              <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, mr: 1 }}>
                {NAV.map((item) => (
                  <Button
                    key={item.href}
                    component={Link}
                    href={item.href}
                    color="inherit"
                    sx={{ color: "text.secondary", fontWeight: 500 }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>

              <Tooltip title="Your cart">
                <IconButton component={Link} href="/shop/cart" aria-label="Cart">
                  <Badge badgeContent={count} color="primary" overlap="circular">
                    <ShoppingCartOutlinedIcon />
                  </Badge>
                </IconButton>
              </Tooltip>

              {customer ? (
                <>
                  <Tooltip title={customer.name}>
                    <IconButton
                      onClick={(e) => setAccountAnchor(e.currentTarget)}
                      aria-label="Account menu"
                      sx={{ ml: 0.5 }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: 13,
                          fontWeight: 700,
                          bgcolor: "primary.light",
                          color: "primary.dark",
                        }}
                      >
                        {initials(customer.name)}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={accountAnchor}
                    open={Boolean(accountAnchor)}
                    onClose={() => setAccountAnchor(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    slotProps={{ paper: { sx: { minWidth: 210, mt: 1 } } }}
                  >
                    <Box sx={{ px: 2, py: 1.25 }}>
                      <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
                        {customer.name}
                      </Typography>
                      <Typography variant="caption">{customer.phone}</Typography>
                    </Box>
                    <Divider />
                    <MenuItem
                      component={Link}
                      href="/shop/account"
                      onClick={() => setAccountAnchor(null)}
                    >
                      <ListItemIcon>
                        <ReceiptLongOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="My orders" />
                    </MenuItem>
                    <MenuItem
                      component={Link}
                      href="/shop/account?tab=addresses"
                      onClick={() => setAccountAnchor(null)}
                    >
                      <ListItemIcon>
                        <PersonOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Addresses & profile" />
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <ListItemIcon>
                        <LogoutOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Sign out" />
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  component={Link}
                  href="/shop/login"
                  variant="outlined"
                  size="small"
                  sx={{ ml: 0.5, whiteSpace: "nowrap" }}
                >
                  Sign in
                </Button>
              )}
            </Box>
          </Toolbar>

          {/* Search moves under the bar on phones, where the toolbar has no room. */}
          <Box
            component="form"
            onSubmit={submitSearch}
            sx={{ display: { xs: "block", md: "none" }, px: 2, pb: 1.5 }}
          >
            <TextField
              size="small"
              fullWidth
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search products…"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="disabled" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Container>
      </AppBar>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {/* ListItemButton, not MenuItem: MUI v9 requires a MenuItem to sit
            inside a Menu or MenuList and throws outside one. */}
        <Box sx={{ width: 260, pt: 2 }} role="presentation">
          <Typography variant="h5" sx={{ px: 2, pb: 1.5, fontWeight: 700 }}>
            {store.storeName}
          </Typography>
          <Divider />
          <List>
            {NAV.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                sx={{ py: 1.5 }}
              >
                <ListItemIcon>
                  <item.icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
            <ListItemButton
              component={Link}
              href={customer ? "/shop/account" : "/shop/login"}
              onClick={() => setDrawerOpen(false)}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <PersonOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={customer ? "My account" : "Sign in"} />
            </ListItemButton>
            <ListItemButton
              component={Link}
              href="/shop/cart"
              onClick={() => setDrawerOpen(false)}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <ShoppingCartOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={count > 0 ? `Cart (${count})` : "Cart"} />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>
    </>
  );
}
