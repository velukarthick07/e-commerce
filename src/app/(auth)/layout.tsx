import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StorefrontIcon from "@mui/icons-material/Storefront";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1fr 1.15fr" },
        bgcolor: "background.default",
      }}
    >
      {/* Brand panel — hidden on small screens so the form gets the space */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          bgcolor: "primary.main",
          color: "#fff",
          p: { md: 5, lg: 7 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2.5,
              bgcolor: "rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <StorefrontIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>FMCG Admin</Typography>
        </Box>

        <Box sx={{ maxWidth: 460 }}>
          <Typography sx={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25, mb: 2 }}>
            Run your whole store from one dashboard.
          </Typography>
          <Typography sx={{ fontSize: 16, opacity: 0.86, lineHeight: 1.65 }}>
            Oils, health mixes, groceries and personal care — manage products,
            batches and expiry, take local orders at the counter, and keep
            inventory accurate on every sale.
          </Typography>

          <Box sx={{ display: "flex", gap: 4, mt: 5 }}>
            {[
              { value: "FEFO", label: "Batch-accurate stock" },
              { value: "Local", label: "Counter order entry" },
              { value: "Live", label: "Sales reporting" },
            ].map((item) => (
              <Box key={item.value}>
                <Typography sx={{ fontSize: 19, fontWeight: 700 }}>{item.value}</Typography>
                <Typography sx={{ fontSize: 13, opacity: 0.8 }}>{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ fontSize: 12.5, opacity: 0.7 }}>
          © {new Date().getFullYear()} FMCG Admin
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, sm: 5 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>{children}</Box>
      </Box>
    </Box>
  );
}
