"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { OtpSignIn } from "@/components/shop/OtpSignIn";
import { useShopAuth } from "@/context/ShopAuthContext";
import { useToast } from "@/context/ToastContext";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setCustomer } = useShopAuth();
  const toast = useToast();

  const next = params.get("next") ?? "/shop/account";

  return (
    <OtpSignIn
      onSuccess={(customer) => {
        setCustomer(customer);
        toast.success(`Welcome, ${customer.name}`);
        // A full refresh so server components re-render with the new session.
        router.replace(next.startsWith("/shop") ? next : "/shop/account");
        router.refresh();
      }}
    />
  );
}

export default function ShopLoginPage() {
  return (
    <Container maxWidth="xs" sx={{ py: { xs: 5, md: 8 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={1} sx={{ mb: 3, alignItems: "center", textAlign: "center" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.light",
              color: "primary.main",
            }}
          >
            <LockOutlinedIcon />
          </Box>
          <Typography variant="h2">Sign in</Typography>
          <Typography variant="body2" color="text.secondary">
            Use your mobile number to see your orders and saved addresses.
          </Typography>
        </Stack>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <Divider sx={{ my: 3 }}>or</Divider>

        <Stack spacing={1} sx={{ textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            You don&apos;t need an account to order.
          </Typography>
          <Typography
            component={Link}
            href="/shop"
            variant="body2"
            sx={{ color: "primary.main", textDecoration: "none", fontWeight: 600 }}
          >
            Continue shopping as a guest
          </Typography>
          <Typography
            component={Link}
            href="/shop/track"
            variant="body2"
            sx={{ color: "text.secondary", textDecoration: "none" }}
          >
            Track an order without signing in
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
