import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ProductImage } from "@/components/shop/ProductImage";
import { TextLink } from "@/components/shop/ShopLink";
import { ProductPurchasePanel } from "@/components/shop/ProductPurchasePanel";
import { ProductCard } from "@/components/shop/ProductCard";
import { storefrontService } from "@/services/storefront.service";
import { serialize } from "@/lib/serialize";
import { NotFoundError } from "@/lib/errors";
import type { ShopProductDetail } from "@/types/shop";

type Params = Promise<{ slug: string }>;

async function load(slug: string): Promise<ShopProductDetail | null> {
  try {
    return serialize(await storefrontService.product(slug)) as unknown as ShopProductDetail;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await load(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
  };
}

/** Only rows with a value are worth a line in the details table. */
function detailRows(product: ShopProductDetail) {
  return [
    ["Brand", product.brand],
    ["Net quantity", product.netQuantity],
    ["Oil type", product.oilType],
    ["Extraction", product.extractionMethod?.replace(/_/g, " ").toLowerCase()],
    ["Packaging", product.packagingType],
    ["Fragrance", product.fragrance],
    ["Ingredients", product.ingredients],
    ["Allergens", product.allergens],
    ["Dietary", product.dietaryInfo],
    ["Storage", product.storageInstructions],
    ["How to use", product.preparationInstructions],
    ["Shelf life", product.shelfLifeDays ? `${product.shelfLifeDays} days` : null],
    ["Manufacturer", product.manufacturer],
    ["Packed by", product.packer],
    ["Country of origin", product.countryOfOrigin],
    ["FSSAI licence", product.fssaiLicense],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await load(slug);
  if (!product) notFound();

  const rows = detailRows(product);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Breadcrumbs sx={{ mb: 2.5, fontSize: 14 }}>
        <TextLink href="/shop" muted>
          Shop
        </TextLink>
        <TextLink href={`/shop?categoryId=${product.category.id}`} muted>
          {product.category.name}
        </TextLink>
        <Typography variant="body2" color="text.primary">
          {product.name}
        </Typography>
      </Breadcrumbs>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 3, md: 5 },
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 420px) minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <ProductImage src={product.images[0]} alt={product.name} />
          {product.images.length > 1 ? (
            <Box sx={{ display: "flex", gap: 1, mt: 1.5, overflowX: "auto" }}>
              {product.images.slice(0, 5).map((image) => (
                <Box key={image} sx={{ width: 72, flexShrink: 0 }}>
                  <ProductImage src={image} alt={product.name} />
                </Box>
              ))}
            </Box>
          ) : null}
        </Paper>

        <Stack spacing={2.5}>
          <Box>
            {product.brand ? (
              <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: ".05em" }}>
                {product.brand}
              </Typography>
            ) : null}
            <Typography variant="h1" sx={{ mt: 0.5 }}>
              {product.name}
            </Typography>
            {product.shortDescription ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {product.shortDescription}
              </Typography>
            ) : null}
          </Box>

          <ProductPurchasePanel product={product} />

          {product.description ? (
            <>
              <Divider />
              <Box>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  About this product
                </Typography>
                <Typography color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                  {product.description}
                </Typography>
              </Box>
            </>
          ) : null}

          {rows.length > 0 ? (
            <>
              <Divider />
              <Box>
                <Typography variant="h4" sx={{ mb: 1.5 }}>
                  Product details
                </Typography>
                <Box
                  component="dl"
                  sx={{
                    m: 0,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "160px minmax(0, 1fr)" },
                    rowGap: 1,
                    columnGap: 2,
                  }}
                >
                  {rows.map(([label, value]) => (
                    <Box key={label} sx={{ display: "contents" }}>
                      <Typography component="dt" variant="body2" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography
                        component="dd"
                        variant="body2"
                        sx={{ m: 0, textTransform: label === "Extraction" ? "capitalize" : "none" }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          ) : null}
        </Stack>
      </Box>

      {product.related.length > 0 ? (
        <Box sx={{ mt: 7 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            More from {product.category.name}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(3, minmax(0, 1fr))",
                md: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            {product.related.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </Box>
        </Box>
      ) : null}
    </Container>
  );
}
