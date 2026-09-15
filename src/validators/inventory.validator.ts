import { z } from "zod";
import { InventoryTransactionType } from "@/generated/prisma/enums";
import {
  optionalFilter,
  optionalMoney,
  paginationQuery,
} from "./common.validator";

export const listInventoryQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  categoryId: optionalFilter(z.coerce.number().int()),
  stockStatus: optionalFilter(z.enum(["in_stock", "low_stock", "out_of_stock"])),
  sortBy: optionalFilter(z.enum(["currentStock", "productName"])),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const adjustStockSchema = z
  .object({
    variantId: z.string().min(1, "Variant is required"),
    type: z.enum(InventoryTransactionType),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    batchId: z.string().optional().or(z.literal("")),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .refine(
    (d) => d.type !== "ORDER_DEDUCTION",
    { path: ["type"], message: "Order deductions are recorded automatically" }
  );

export const setMinMaxSchema = z.object({
  variantId: z.string().min(1),
  minStock: z.coerce.number().int().min(0),
  maxStock: z.coerce.number().int().min(0),
});

export const createBatchSchema = z
  .object({
    variantId: z.string().min(1, "Variant is required"),
    batchNumber: z.string().trim().min(1, "Batch number is required").max(60),
    manufacturingDate: z.coerce.date().nullable().optional(),
    expiryDate: z.coerce.date().nullable().optional(),
    bestBeforeDate: z.coerce.date().nullable().optional(),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    purchasePrice: optionalMoney,
    mrp: optionalMoney,
    sellingPrice: optionalMoney,
    receivedDate: z.coerce.date().default(() => new Date()),
  })
  .superRefine((d, ctx) => {
    if (d.manufacturingDate && d.expiryDate && d.manufacturingDate > d.expiryDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after the manufacturing date",
      });
    }
  });

export const updateBatchSchema = createBatchSchema;

export const listBatchesQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  productId: optionalFilter(z.string()),
  variantId: optionalFilter(z.string()),
  categoryId: optionalFilter(z.coerce.number().int()),
  expiryBucket: optionalFilter(
    z.enum(["expired", "7_days", "30_days", "60_days", "normal"])
  ),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listTransactionsQuery = paginationQuery.extend({
  productId: optionalFilter(z.string()),
  variantId: optionalFilter(z.string()),
  type: optionalFilter(z.enum(InventoryTransactionType)),
  orderId: optionalFilter(z.string()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
