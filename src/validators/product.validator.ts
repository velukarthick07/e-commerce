import { z } from "zod";
import { ExtractionMethod, ProductType } from "@/generated/prisma/enums";
import {
  money,
  optionalFilter,
  optionalMoney,
  paginationQuery,
  sortQuery,
} from "./common.validator";

/**
 * An optional free-text field.
 *
 * `null` is accepted alongside "" and undefined so a product read back from
 * the API can be sent straight to PUT unchanged — Prisma returns null for an
 * empty column, and refusing it would make read-then-write round-trips fail.
 */
const optionalText = (max = 2000) =>
  z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().trim().max(max).optional().or(z.literal(""))
  );

export const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Variant name is required").max(100),
  sku: z.string().trim().min(2, "SKU is required").max(60),
  barcode: optionalText(60),
  mrp: money,
  sellingPrice: money,
  discountPrice: optionalMoney,
  weightGrams: optionalMoney,
  volumeMl: optionalMoney,
  imageUrl: optionalText(500),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  // Opening stock — only applied when the variant is first created
  openingStock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(10),
  maxStock: z.coerce.number().int().min(0).default(1000),
});

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2, "Product name is required").max(200),
    sku: z.string().trim().min(2, "SKU is required").max(60),
    barcode: optionalText(60),
    brand: optionalText(100),
    description: optionalText(5000),
    shortDescription: optionalText(300),
    images: z.array(z.string().trim().max(500)).max(10).default([]),

    categoryId: z.coerce.number().int().positive("Select a category"),
    subcategoryId: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().positive().nullable()
    ),

    mrp: money,
    sellingPrice: money,
    discountPrice: optionalMoney,
    taxRate: z.coerce.number().min(0).max(100).default(0),
    hsnCode: optionalText(20),

    minStock: z.coerce.number().int().min(0).default(10),
    maxStock: z.coerce.number().int().min(0).default(1000),
    unit: z.string().trim().min(1).max(20).default("piece"),

    netQuantity: optionalText(50),
    weight: optionalMoney,
    lengthCm: optionalMoney,
    widthCm: optionalMoney,
    heightCm: optionalMoney,

    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),

    productType: z.enum(ProductType).default("OTHER"),
    ingredients: optionalText(),
    nutritionalInfo: z.record(z.string(), z.string()).nullable().optional(),
    allergens: optionalText(500),
    dietaryInfo: optionalText(500),
    storageInstructions: optionalText(1000),
    preparationInstructions: optionalText(1000),
    shelfLifeDays: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(0).max(3650).nullable()
    ),
    countryOfOrigin: optionalText(80),
    manufacturer: optionalText(200),
    packer: optionalText(200),
    fssaiLicense: optionalText(50),
    oilType: optionalText(80),
    extractionMethod: z.enum(ExtractionMethod).default("NOT_APPLICABLE"),
    packagingType: optionalText(80),
    fragrance: optionalText(80),

    variants: z
      .array(variantSchema)
      .min(1, "Add at least one variant")
      .max(30, "Too many variants"),
  })
  .superRefine((data, ctx) => {
    if (data.sellingPrice > data.mrp) {
      ctx.addIssue({
        code: "custom",
        path: ["sellingPrice"],
        message: "Selling price cannot exceed MRP",
      });
    }
    data.variants.forEach((v, i) => {
      if (v.sellingPrice > v.mrp) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "sellingPrice"],
          message: "Selling price cannot exceed MRP",
        });
      }
      if (v.discountPrice !== undefined && v.discountPrice > v.sellingPrice) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "discountPrice"],
          message: "Discount price cannot exceed selling price",
        });
      }
    });
    const skus = data.variants.map((v) => v.sku.toUpperCase());
    const dupe = skus.find((s, i) => skus.indexOf(s) !== i);
    if (dupe) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: `Duplicate variant SKU: ${dupe}`,
      });
    }
  });

export const updateProductSchema = createProductSchema;

export const listProductsQuery = paginationQuery.merge(sortQuery).extend({
  search: z.string().trim().optional(),
  categoryId: optionalFilter(z.coerce.number().int()),
  subcategoryId: optionalFilter(z.coerce.number().int()),
  brand: optionalFilter(z.string()),
  productType: optionalFilter(z.enum(ProductType)),
  isActive: optionalFilter(z.enum(["true", "false"])),
  isFeatured: optionalFilter(z.enum(["true", "false"])),
  stockStatus: optionalFilter(z.enum(["in_stock", "low_stock", "out_of_stock"])),
});

/** Fast lookup used by the local-order screen (name / SKU / barcode / brand). */
export const productSearchQuery = z.object({
  q: z.string().trim().max(120).default(""),
  categoryId: optionalFilter(z.coerce.number().int()),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const barcodeLookupQuery = z.object({
  barcode: z.string().trim().min(1, "Barcode is required").max(60),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
