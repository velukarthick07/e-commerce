"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusChip } from "@/components/common/StatusChip";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useOne } from "@/hooks/useApiResource";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { del, ApiError } from "@/services/api/client";
import { formatMoney, humanise } from "@/lib/format";
import type { ProductDto } from "@/types/models";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAuth();
  const toast = useToast();
  const { data: product, loading, error } = useOne<ProductDto>(`/products/${id}`);
  const [tab, setTab] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = async () => {
    try {
      const result = await del(`/products/${id}`);
      toast.success(result.message);
      router.push("/products");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete this product");
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Product" />
        <Skeleton variant="rounded" height={460} />
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <PageHeader title="Product" breadcrumbs={[{ label: "Products", href: "/products" }]} />
        <Alert severity="error">{error ?? "This product could not be found."}</Alert>
      </>
    );
  }

  const totalStock = product.variants.reduce(
    (sum, v) => sum + (v.inventory?.currentStock ?? 0),
    0
  );

  const foodFields = [
    ["Ingredients", product.ingredients],
    ["Allergens", product.allergens],
    ["Dietary information", product.dietaryInfo],
    ["Storage", product.storageInstructions],
    ["Preparation", product.preparationInstructions],
    ["Shelf life", product.shelfLifeDays ? `${product.shelfLifeDays} days` : null],
    ["Country of origin", product.countryOfOrigin],
    ["Manufacturer", product.manufacturer],
    ["Packed by", product.packer],
    ["FSSAI licence", product.fssaiLicense],
    ["Oil type", product.oilType],
    ["Extraction method", product.extractionMethod ? humanise(product.extractionMethod) : null],
    ["Packaging", product.packagingType],
    ["Fragrance", product.fragrance],
  ].filter(([, value]) => !!value) as [string, string][];

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${product.sku}${product.brand ? ` · ${product.brand}` : ""}`}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: product.name },
        ]}
        actions={
          <>
            {can("products:update") && (
              <Button
                component={Link}
                href={`/products/${product.id}/edit`}
                variant="contained"
                startIcon={<EditOutlinedIcon />}
              >
                Edit
              </Button>
            )}
            {can("products:delete") && (
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteOutlinedIcon />}
                onClick={() => setConfirmOpen(true)}
              >
                Delete
              </Button>
            )}
          </>
        }
      />

      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Chip
          size="small"
          label={product.isActive ? "Active" : "Inactive"}
          sx={product.isActive ? { bgcolor: "#12B76A1A", color: "success.main" } : undefined}
          variant={product.isActive ? "filled" : "outlined"}
        />
        {product.isFeatured && <Chip size="small" color="warning" label="Featured" />}
        <Chip size="small" variant="outlined" label={humanise(product.productType)} />
        <Chip size="small" variant="outlined" label={product.category.name} />
        {product.subcategory && <Chip size="small" variant="outlined" label={product.subcategory.name} />}
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 320px" }, alignItems: "start" }}>
        <Box>
          <Card sx={{ mb: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab label={`Variants (${product.variants.length})`} />
              <Tab label="Details" />
              {foodFields.length > 0 && <Tab label="Product information" />}
            </Tabs>

            <CardContent sx={{ p: tab === 0 ? 0 : 2.5, "&:last-child": { pb: tab === 0 ? 0 : 2.5 } }}>
              {tab === 0 && (
                <Box sx={{ overflowX: "auto" }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Variant</TableCell>
                        <TableCell>SKU / Barcode</TableCell>
                        <TableCell align="right">MRP</TableCell>
                        <TableCell align="right">Selling</TableCell>
                        <TableCell align="center">Stock</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {product.variants.map((variant) => {
                        const stock = variant.inventory?.currentStock ?? 0;
                        const min = variant.inventory?.minStock ?? 0;
                        const status = stock <= 0 ? "out_of_stock" : stock <= min ? "low_stock" : "in_stock";
                        return (
                          <TableRow key={variant.id}>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                                  {variant.name}
                                </Typography>
                                {variant.isDefault && (
                                  <Chip size="small" label="Default" variant="outlined" />
                                )}
                                {!variant.isActive && (
                                  <Chip size="small" label="Inactive" color="default" variant="outlined" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontSize: 13 }}>{variant.sku}</Typography>
                              {variant.barcode && (
                                <Typography variant="caption">{variant.barcode}</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{formatMoney(variant.mrp)}</TableCell>
                            <TableCell align="right">
                              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {formatMoney(variant.discountPrice ?? variant.sellingPrice)}
                              </Typography>
                              {variant.discountPrice && (
                                <Typography variant="caption" sx={{ textDecoration: "line-through" }}>
                                  {formatMoney(variant.sellingPrice)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{stock}</Typography>
                              <Typography variant="caption">min {min}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <StatusChip value={status} kind="stock" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {tab === 1 && (
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                  <Field label="SKU" value={product.sku} />
                  <Field label="Barcode" value={product.barcode ?? "—"} />
                  <Field label="Brand" value={product.brand ?? "—"} />
                  <Field label="Unit" value={product.unit} />
                  <Field label="Net quantity" value={product.netQuantity ?? "—"} />
                  <Field label="HSN code" value={product.hsnCode ?? "—"} />
                  <Field label="Tax rate" value={`${product.taxRate}%`} />
                  <Field label="Min / max stock" value={`${product.minStock} / ${product.maxStock}`} />
                  <Field
                    label="Dimensions"
                    value={
                      product.lengthCm || product.widthCm || product.heightCm
                        ? `${product.lengthCm ?? "—"} × ${product.widthCm ?? "—"} × ${product.heightCm ?? "—"} cm`
                        : "—"
                    }
                  />
                  <Field label="Weight" value={product.weight ? `${product.weight} kg` : "—"} />
                  {product.description && (
                    <Box sx={{ gridColumn: { sm: "span 2" } }}>
                      <Field label="Description" value={product.description} />
                    </Box>
                  )}
                </Box>
              )}

              {tab === 2 && foodFields.length > 0 && (
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                  {foodFields.map(([label, value]) => (
                    <Field key={label} label={label} value={value} />
                  ))}
                  {product.nutritionalInfo && (
                    <Box sx={{ gridColumn: { sm: "span 2" } }}>
                      <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
                        Nutritional information
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        {Object.entries(product.nutritionalInfo).map(([key, value]) => (
                          <Chip key={key} size="small" variant="outlined" label={`${key}: ${value}`} />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ display: "grid", gap: 2 }}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: 2.5,
                  bgcolor: "primary.light",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  mb: 2,
                }}
              >
                {product.images[0] ? (
                  <Box
                    component="img"
                    src={product.images[0]}
                    alt={product.name}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Inventory2OutlinedIcon sx={{ fontSize: 54, color: "primary.main", opacity: 0.5 }} />
                )}
              </Box>

              {product.images.length > 1 && (
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {product.images.slice(1).map((image) => (
                    <Box
                      key={image}
                      component="img"
                      src={image}
                      alt=""
                      sx={{ width: 56, height: 56, objectFit: "cover", borderRadius: 1.5, border: 1, borderColor: "divider" }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>At a glance</Typography>
              <Field label="Price from" value={formatMoney(Math.min(...product.variants.map((v) => v.discountPrice ?? v.sellingPrice)))} />
              <Field label="Total stock" value={`${totalStock} ${product.unit}`} />
              <Field label="Variants" value={String(product.variants.length)} />
              <Button
                component={Link}
                href={`/inventory?search=${encodeURIComponent(product.sku)}`}
                size="small"
                sx={{ mt: 1 }}
              >
                Manage inventory
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this product?"
        message={
          <>
            <strong>{product.name}</strong> and all of its variants will be permanently removed.
            This cannot be undone.
          </>
        }
        onConfirm={remove}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography variant="caption" sx={{ display: "block" }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{value}</Typography>
    </Box>
  );
}
