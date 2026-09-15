"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { PageHeader } from "@/components/common/PageHeader";
import { formResolver } from "@/lib/form";
import { ImageUploader } from "./ImageUploader";
import { VariantEditor } from "./VariantEditor";
import {
  EMPTY_PRODUCT,
  productFormSchema,
  toApiPayload,
  type ProductFormValues,
} from "./productSchema";
import { getList, post, put, ApiError } from "@/services/api/client";
import { useToast } from "@/context/ToastContext";
import type { CategoryDto, ProductDto } from "@/types/models";

const PRODUCT_TYPES = [
  { value: "FOOD", label: "Food" },
  { value: "OIL", label: "Edible oil" },
  { value: "GROCERY", label: "Grocery" },
  { value: "PERSONAL_CARE", label: "Personal care" },
  { value: "HOUSEHOLD", label: "Household" },
  { value: "OTHER", label: "Other" },
];

const EXTRACTION_METHODS = [
  { value: "NOT_APPLICABLE", label: "Not applicable" },
  { value: "COLD_PRESSED", label: "Cold pressed" },
  { value: "WOOD_PRESSED", label: "Wood pressed" },
  { value: "FILTERED", label: "Filtered" },
  { value: "REFINED", label: "Refined" },
];

const UNITS = ["piece", "bottle", "pack", "jar", "bag", "kg", "g", "litre", "ml", "box"];

/** Maps an existing product into form values. */
function toFormValues(product: ProductDto): ProductFormValues {
  return {
    ...EMPTY_PRODUCT,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? "",
    brand: product.brand ?? "",
    description: product.description ?? "",
    shortDescription: product.shortDescription ?? "",
    images: product.images ?? [],
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId ?? "",
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    discountPrice: product.discountPrice ?? "",
    taxRate: product.taxRate,
    hsnCode: product.hsnCode ?? "",
    minStock: product.minStock,
    maxStock: product.maxStock,
    unit: product.unit,
    netQuantity: product.netQuantity ?? "",
    weight: product.weight ?? "",
    lengthCm: product.lengthCm ?? "",
    widthCm: product.widthCm ?? "",
    heightCm: product.heightCm ?? "",
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    productType: product.productType,
    ingredients: product.ingredients ?? "",
    allergens: product.allergens ?? "",
    dietaryInfo: product.dietaryInfo ?? "",
    storageInstructions: product.storageInstructions ?? "",
    preparationInstructions: product.preparationInstructions ?? "",
    shelfLifeDays: product.shelfLifeDays ?? "",
    countryOfOrigin: product.countryOfOrigin ?? "India",
    manufacturer: product.manufacturer ?? "",
    packer: product.packer ?? "",
    fssaiLicense: product.fssaiLicense ?? "",
    oilType: product.oilType ?? "",
    extractionMethod: (product.extractionMethod as ProductFormValues["extractionMethod"]) ?? "NOT_APPLICABLE",
    packagingType: product.packagingType ?? "",
    fragrance: product.fragrance ?? "",
    variants: product.variants.map((variant, index) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode ?? "",
      mrp: variant.mrp,
      sellingPrice: variant.sellingPrice,
      discountPrice: variant.discountPrice ?? "",
      weightGrams: variant.weightGrams ?? "",
      volumeMl: variant.volumeMl ?? "",
      imageUrl: variant.imageUrl ?? "",
      isDefault: variant.isDefault,
      isActive: variant.isActive,
      sortOrder: index,
      openingStock: 0,
      minStock: variant.inventory?.minStock ?? 10,
      maxStock: variant.inventory?.maxStock ?? 1000,
    })),
  };
}

export function ProductForm({ product }: { product?: ProductDto }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!product;
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: formResolver<ProductFormValues>(productFormSchema),
    defaultValues: product ? toFormValues(product) : EMPTY_PRODUCT,
  });

  const fieldArray = useFieldArray({ control, name: "variants" });

  useEffect(() => {
    void getList<CategoryDto>("/categories/tree")
      .then(({ data }) => setCategories(data))
      .catch(() => undefined);
  }, []);

  const categoryId = watch("categoryId");
  const productType = watch("productType");
  const images = watch("images");
  const subcategories =
    categories.find((c) => c.id === Number(categoryId))?.children ?? [];

  const onSubmit = handleSubmit(async (values) => {
    const payload = toApiPayload(values as never);

    try {
      const result = isEdit
        ? await put<ProductDto>(`/products/${product!.id}`, payload)
        : await post<ProductDto>("/products", payload);

      toast.success(result.message);
      router.push(`/products/${result.data.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          setError(field as keyof ProductFormValues, { message: messages[0] });
        }
        toast.error("Please correct the highlighted fields");
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Unable to save this product");
    }
  });

  const isFood = productType === "FOOD" || productType === "OIL" || productType === "GROCERY";
  const isOil = productType === "OIL";
  const isPersonalCare = productType === "PERSONAL_CARE" || productType === "HOUSEHOLD";

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <PageHeader
        title={isEdit ? "Edit Product" : "Add Product"}
        subtitle={isEdit ? product!.name : "Create a product with one or more sellable variants"}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: isEdit ? "Edit" : "New product" },
        ]}
        actions={
          <>
            <Button onClick={() => router.back()} color="inherit">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              loading={isSubmitting}
              startIcon={<SaveOutlinedIcon />}
            >
              {isEdit ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      />

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 320px" }, alignItems: "start" }}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Section title="Basic details">
            <Grid2>
              <Box sx={{ gridColumn: { sm: "span 2" } }}>
                <TextField
                  {...register("name")}
                  label="Product name"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              </Box>
              <TextField
                {...register("sku")}
                label="SKU"
                error={!!errors.sku}
                helperText={errors.sku?.message}
              />
              <TextField {...register("barcode")} label="Barcode" />
              <TextField {...register("brand")} label="Brand" />
              <TextField select {...register("productType")} label="Product type" value={watch("productType")}>
                {PRODUCT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Category"
                value={categoryId || ""}
                onChange={(e) => {
                  setValue("categoryId", Number(e.target.value));
                  setValue("subcategoryId", "");
                }}
                error={!!errors.categoryId}
                helperText={errors.categoryId?.message}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Subcategory"
                value={watch("subcategoryId") || ""}
                onChange={(e) => setValue("subcategoryId", e.target.value === "" ? "" : Number(e.target.value))}
                disabled={subcategories.length === 0}
                helperText={subcategories.length === 0 ? "No subcategories" : undefined}
              >
                <MenuItem value="">None</MenuItem>
                {subcategories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>

              <Box sx={{ gridColumn: { sm: "span 2" } }}>
                <TextField {...register("shortDescription")} label="Short description" />
              </Box>
              <Box sx={{ gridColumn: { sm: "span 2" } }}>
                <TextField {...register("description")} label="Description" multiline rows={4} />
              </Box>
            </Grid2>
          </Section>

          <Section title="Pricing & tax" subtitle="Defaults for the product — each variant sets its own price">
            <Grid2>
              <TextField
                {...register("mrp")}
                label="MRP"
                type="number"
                error={!!errors.mrp}
                helperText={errors.mrp?.message}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
              />
              <TextField
                {...register("sellingPrice")}
                label="Selling price"
                type="number"
                error={!!errors.sellingPrice}
                helperText={errors.sellingPrice?.message}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
              />
              <TextField
                {...register("taxRate")}
                label="GST / tax rate"
                type="number"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              />
              <TextField {...register("hsnCode")} label="HSN code" />
              <TextField select {...register("unit")} label="Unit" value={watch("unit")}>
                {UNITS.map((u) => (
                  <MenuItem key={u} value={u}>{u}</MenuItem>
                ))}
              </TextField>
              <TextField {...register("netQuantity")} label="Net quantity" placeholder="1 L" />
            </Grid2>
          </Section>

          <Section
            title="Variants"
            subtitle="Every product needs at least one variant — stock lives on the variant"
          >
            <VariantEditor
              fieldArray={fieldArray}
              register={register}
              errors={errors}
              watch={watch}
              setValue={setValue}
              isEdit={isEdit}
            />
          </Section>

          {isFood && (
            <Section title="Food information" subtitle="Shown on the product page and used for compliance">
              <Grid2>
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField {...register("ingredients")} label="Ingredients" multiline rows={2} />
                </Box>
                <TextField {...register("allergens")} label="Allergens" placeholder="Contains peanuts" />
                <TextField {...register("dietaryInfo")} label="Dietary information" placeholder="Vegetarian, Vegan" />
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField {...register("storageInstructions")} label="Storage instructions" />
                </Box>
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField {...register("preparationInstructions")} label="Preparation instructions" />
                </Box>
                <TextField {...register("shelfLifeDays")} label="Shelf life (days)" type="number" />
                <TextField {...register("fssaiLicense")} label="FSSAI licence" />
                <TextField {...register("countryOfOrigin")} label="Country of origin" />
                <TextField {...register("manufacturer")} label="Manufacturer" />
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField {...register("packer")} label="Packed by" />
                </Box>
              </Grid2>
              <Typography variant="caption" sx={{ display: "block", mt: 1.5 }}>
                Manufacturing, expiry and batch numbers are recorded per batch in Inventory → Batches.
              </Typography>
            </Section>
          )}

          {isOil && (
            <Section title="Oil information">
              <Grid2>
                <TextField {...register("oilType")} label="Oil type" placeholder="Groundnut" />
                <TextField
                  select
                  {...register("extractionMethod")}
                  label="Extraction method"
                  value={watch("extractionMethod")}
                >
                  {EXTRACTION_METHODS.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </TextField>
                <TextField {...register("packagingType")} label="Packaging type" placeholder="PET bottle" />
              </Grid2>
            </Section>
          )}

          {isPersonalCare && (
            <Section title="Personal care information">
              <Grid2>
                <TextField {...register("fragrance")} label="Fragrance" />
                <TextField {...register("packagingType")} label="Packaging type" />
                <Box sx={{ gridColumn: { sm: "span 2" } }}>
                  <TextField {...register("ingredients")} label="Ingredients" multiline rows={2} />
                </Box>
              </Grid2>
            </Section>
          )}

          <Section title="Shipping dimensions">
            <Grid2>
              <TextField {...register("weight")} label="Weight (kg)" type="number" />
              <TextField {...register("lengthCm")} label="Length (cm)" type="number" />
              <TextField {...register("widthCm")} label="Width (cm)" type="number" />
              <TextField {...register("heightCm")} label="Height (cm)" type="number" />
            </Grid2>
          </Section>
        </Box>

        {/* Sidebar */}
        <Box sx={{ display: "grid", gap: 2, position: { lg: "sticky" }, top: { lg: 88 } }}>
          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>Visibility</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={watch("isActive")}
                    onChange={(e) => setValue("isActive", e.target.checked)}
                  />
                }
                label="Active (available for sale)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={watch("isFeatured")}
                    onChange={(e) => setValue("isFeatured", e.target.checked)}
                  />
                }
                label="Featured product"
              />
              <Divider sx={{ my: 2 }} />
              <Typography variant="h5" sx={{ mb: 1.5 }}>Default stock levels</Typography>
              <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr 1fr" }}>
                <TextField {...register("minStock")} label="Min" type="number" />
                <TextField {...register("maxStock")} label="Max" type="number" />
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h5" sx={{ mb: 2 }}>Images</Typography>
              <ImageUploader
                images={images ?? []}
                onChange={(next) => setValue("images", next)}
              />
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5">{title}</Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ display: "block", mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ mt: subtitle ? 0 : 2 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
      }}
    >
      {children}
    </Box>
  );
}
