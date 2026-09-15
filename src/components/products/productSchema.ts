import { z } from "zod";

/**
 * Form-side schema. Numeric inputs arrive as strings, so optional money
 * fields accept "" and are converted before the request is sent.
 */
const optionalNumber = z.union([z.literal(""), z.coerce.number().min(0)]);

export const variantFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Variant name is required"),
  sku: z.string().trim().min(2, "SKU is required"),
  barcode: z.string().trim().optional(),
  mrp: z.coerce.number().min(0, "Enter the MRP"),
  sellingPrice: z.coerce.number().min(0, "Enter the selling price"),
  discountPrice: optionalNumber.optional(),
  weightGrams: optionalNumber.optional(),
  volumeMl: optionalNumber.optional(),
  imageUrl: z.string().trim().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  openingStock: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  maxStock: z.coerce.number().int().min(0),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Product name is required"),
    sku: z.string().trim().min(2, "SKU is required"),
    barcode: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    description: z.string().trim().optional(),
    shortDescription: z.string().trim().optional(),
    images: z.array(z.string()),

    categoryId: z.coerce.number().int().positive("Select a category"),
    subcategoryId: z.union([z.literal(""), z.coerce.number().int().positive()]),

    mrp: z.coerce.number().min(0, "Enter the MRP"),
    sellingPrice: z.coerce.number().min(0, "Enter the selling price"),
    discountPrice: optionalNumber.optional(),
    taxRate: z.coerce.number().min(0).max(100),
    hsnCode: z.string().trim().optional(),

    minStock: z.coerce.number().int().min(0),
    maxStock: z.coerce.number().int().min(0),
    unit: z.string().trim().min(1, "Unit is required"),

    netQuantity: z.string().trim().optional(),
    weight: optionalNumber.optional(),
    lengthCm: optionalNumber.optional(),
    widthCm: optionalNumber.optional(),
    heightCm: optionalNumber.optional(),

    isFeatured: z.boolean(),
    isActive: z.boolean(),

    productType: z.enum(["FOOD", "OIL", "PERSONAL_CARE", "HOUSEHOLD", "GROCERY", "OTHER"]),
    ingredients: z.string().trim().optional(),
    allergens: z.string().trim().optional(),
    dietaryInfo: z.string().trim().optional(),
    storageInstructions: z.string().trim().optional(),
    preparationInstructions: z.string().trim().optional(),
    shelfLifeDays: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional(),
    countryOfOrigin: z.string().trim().optional(),
    manufacturer: z.string().trim().optional(),
    packer: z.string().trim().optional(),
    fssaiLicense: z.string().trim().optional(),
    oilType: z.string().trim().optional(),
    extractionMethod: z.enum([
      "COLD_PRESSED", "WOOD_PRESSED", "FILTERED", "REFINED", "NOT_APPLICABLE",
    ]),
    packagingType: z.string().trim().optional(),
    fragrance: z.string().trim().optional(),

    variants: z.array(variantFormSchema).min(1, "Add at least one variant"),
  })
  .superRefine((data, ctx) => {
    if (data.sellingPrice > data.mrp) {
      ctx.addIssue({ code: "custom", path: ["sellingPrice"], message: "Cannot exceed MRP" });
    }
    data.variants.forEach((variant, index) => {
      if (variant.sellingPrice > variant.mrp) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "sellingPrice"],
          message: "Cannot exceed MRP",
        });
      }
      if (
        variant.discountPrice !== "" &&
        variant.discountPrice !== undefined &&
        Number(variant.discountPrice) > variant.sellingPrice
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "discountPrice"],
          message: "Cannot exceed selling price",
        });
      }
    });
  });

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  sku: "",
  barcode: "",
  brand: "",
  description: "",
  shortDescription: "",
  images: [],
  categoryId: 0,
  subcategoryId: "",
  mrp: 0,
  sellingPrice: 0,
  discountPrice: "",
  taxRate: 5,
  hsnCode: "",
  minStock: 10,
  maxStock: 1000,
  unit: "piece",
  netQuantity: "",
  weight: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  isFeatured: false,
  isActive: true,
  productType: "OTHER",
  ingredients: "",
  allergens: "",
  dietaryInfo: "",
  storageInstructions: "",
  preparationInstructions: "",
  shelfLifeDays: "",
  countryOfOrigin: "India",
  manufacturer: "",
  packer: "",
  fssaiLicense: "",
  oilType: "",
  extractionMethod: "NOT_APPLICABLE",
  packagingType: "",
  fragrance: "",
  variants: [
    {
      name: "",
      sku: "",
      barcode: "",
      mrp: 0,
      sellingPrice: 0,
      discountPrice: "",
      weightGrams: "",
      volumeMl: "",
      imageUrl: "",
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      openingStock: 0,
      minStock: 10,
      maxStock: 1000,
    },
  ],
};

/** Converts "" placeholders into the nulls/undefined the API expects. */
export function toApiPayload(values: ProductFormOutput) {
  const num = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : Number(v));

  return {
    ...values,
    subcategoryId: values.subcategoryId === "" ? null : Number(values.subcategoryId),
    discountPrice: num(values.discountPrice),
    weight: num(values.weight),
    lengthCm: num(values.lengthCm),
    widthCm: num(values.widthCm),
    heightCm: num(values.heightCm),
    shelfLifeDays: values.shelfLifeDays === "" ? null : Number(values.shelfLifeDays),
    variants: values.variants.map((variant, index) => ({
      ...variant,
      sortOrder: index,
      discountPrice: num(variant.discountPrice),
      weightGrams: num(variant.weightGrams),
      volumeMl: num(variant.volumeMl),
    })),
  };
}
