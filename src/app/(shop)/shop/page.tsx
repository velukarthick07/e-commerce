import { Suspense } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { CatalogueControls } from "@/components/shop/CatalogueControls";
import { LinkButton } from "@/components/shop/ShopLink";
import { ProductCard } from "@/components/shop/ProductCard";
import { storefrontService } from "@/services/storefront.service";
import { catalogueQuery } from "@/validators/storefront.validator";
import { serialize } from "@/lib/serialize";
import { formatMoney } from "@/lib/format";
import type { ShopCategory, ShopProduct } from "@/types/shop";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Keeps every active filter when building page links. */
function pageHref(
  params: Record<string, string | string[] | undefined>,
  page: number
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    next.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }
  if (page > 1) next.set("page", String(page));
  const qs = next.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;

  // Unknown or malformed query values fall back to defaults rather than 500 —
  // a hand-edited URL should never break the shop.
  const parsed = catalogueQuery.safeParse(raw);
  const query = parsed.success ? parsed.data : catalogueQuery.parse({});

  const [catalogue, categoryRows, store] = await Promise.all([
    storefrontService.catalogue(query),
    storefrontService.categories(),
    storefrontService.storeInfo(),
  ]);

  const products = serialize(catalogue.items) as unknown as ShopProduct[];
  const categories = serialize(categoryRows) as unknown as ShopCategory[];
  const { meta } = catalogue;
  const filtered = Boolean(query.search || query.categoryId || query.featured);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      {!filtered && meta.page === 1 ? (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 3,
            background:
              "linear-gradient(120deg, rgba(127,86,217,.10), rgba(127,86,217,.02))",
            borderColor: "primary.light",
          }}
        >
          <Typography variant="h1" sx={{ mb: 1.5, maxWidth: 620 }}>
            Everyday essentials, pressed and packed fresh
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 560, mb: 2.5 }}>
            Cold-pressed oils, millets, health mixes, spices and household
            staples.{" "}
            {store.delivery.freeDeliveryAbove > 0
              ? `Free delivery on orders over ${formatMoney(store.delivery.freeDeliveryAbove, store.currencySymbol)}.`
              : "Free delivery on every order."}
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <LinkButton href="#products" variant="contained">
              Start shopping
            </LinkButton>
            <LinkButton href="/shop/track" variant="outlined">
              Track an order
            </LinkButton>
          </Stack>
        </Paper>
      ) : null}

      <Box id="products" sx={{ scrollMarginTop: 96 }}>
        <Suspense fallback={null}>
          <CatalogueControls categories={categories} total={meta.total} />
        </Suspense>
      </Box>

      {products.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ mt: 4, p: 6, textAlign: "center", borderStyle: "dashed" }}
        >
          <SearchOffOutlinedIcon sx={{ fontSize: 44, color: "text.disabled", mb: 1 }} />
          <Typography variant="h4" sx={{ mb: 0.5 }}>
            Nothing matched that
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5 }}>
            Try a different search, or browse the full range.
          </Typography>
          <LinkButton href="/shop" variant="outlined">
            Show all products
          </LinkButton>
        </Paper>
      ) : (
        <Box
          sx={{
            mt: 3,
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              sm: "repeat(3, minmax(0, 1fr))",
              md: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Box>
      )}

      {meta.totalPages > 1 ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 4, justifyContent: "center", alignItems: "center" }}
        >
          <LinkButton
            href={pageHref(raw, meta.page - 1)}
            disabled={!meta.hasPrev}
            variant="outlined"
            size="small"
          >
            Previous
          </LinkButton>
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            Page {meta.page} of {meta.totalPages}
          </Typography>
          <LinkButton
            href={pageHref(raw, meta.page + 1)}
            disabled={!meta.hasNext}
            variant="outlined"
            size="small"
          >
            Next
          </LinkButton>
        </Stack>
      ) : null}
    </Container>
  );
}
