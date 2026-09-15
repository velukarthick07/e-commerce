import { z } from "zod";
import { DeliveryType, PaymentMethod, ProductType } from "@/generated/prisma/enums";
import { normalisePhone } from "@/lib/phone";
import { optionalFilter, paginationQuery } from "./common.validator";

/**
 * The storefront keys everything off the mobile number, so it is normalised
 * (country code and trunk prefix stripped) before validation rather than
 * after — "+91 98400 12345" and "9840012345" must reach the service as the
 * same string or they would create two customer records.
 */
export const storefrontPhone = z
  .string()
  .trim()
  .transform(normalisePhone)
  .refine((v) => /^\d{10}$/.test(v), "Enter a valid 10-digit mobile number");

export const otpRequestSchema = z.object({
  phone: storefrontPhone,
});

export const otpVerifySchema = z.object({
  phone: storefrontPhone,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const phoneLookupSchema = z.object({
  phone: storefrontPhone,
});

export const catalogueQuery = paginationQuery.extend({
  search: z.string().trim().max(120).optional(),
  categoryId: optionalFilter(z.coerce.number().int().positive()),
  productType: optionalFilter(z.enum(ProductType)),
  brand: optionalFilter(z.string().trim().max(80)),
  minPrice: optionalFilter(z.coerce.number().min(0)),
  maxPrice: optionalFilter(z.coerce.number().min(0)),
  inStockOnly: optionalFilter(z.enum(["true", "false"])),
  featured: optionalFilter(z.enum(["true", "false"])),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "newest", "name"])
    .default("relevance"),
});

const cartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const storefrontQuoteSchema = z.object({
  items: z.array(cartItemSchema).max(100).default([]),
  couponCode: z.string().trim().toUpperCase().max(24).optional().or(z.literal("")),
  deliveryType: z.enum(DeliveryType).default("DELIVERY"),
});

/** `null` is accepted alongside "" and undefined so a round-tripped address
 *  (where Prisma returns null for an empty line) can be sent straight back. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === null ? "" : v),
    z.string().trim().max(max).optional().or(z.literal(""))
  );

export const storefrontAddressSchema = z.object({
  label: z.string().trim().max(40).default("Home"),
  line1: z.string().trim().min(3, "House / street is required").max(200),
  line2: optionalText(200),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  postalCode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  landmark: optionalText(120),
  isDefault: z.boolean().default(false),
});

/**
 * Checkout payload. Notably absent: prices, totals, discounts and order
 * status — the server recomputes all of them (spec §28), so a crafted request
 * cannot buy anything at the wrong price or mark itself paid.
 */
export const placeOrderSchema = z
  .object({
    items: z.array(cartItemSchema).min(1, "Your cart is empty").max(100),

    name: z.string().trim().min(2, "Name is required").max(120),
    phone: storefrontPhone,
    email: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().trim().email("Enter a valid email").optional()
    ),

    deliveryType: z.enum(DeliveryType).default("DELIVERY"),
    /** An existing saved address; only honoured for a signed-in customer. */
    addressId: z.string().trim().min(1).optional(),
    address: storefrontAddressSchema.optional(),
    saveAddress: z.boolean().default(true),

    deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
    couponCode: z.string().trim().toUpperCase().max(24).optional().or(z.literal("")),
    paymentMethod: z.enum(PaymentMethod).default("COD"),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryType === "DELIVERY" && !data.addressId && !data.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "A delivery address is required",
      });
    }
    const ids = data.items.map((i) => i.variantId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "The same item appears more than once in your cart",
      });
    }
  });

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(3, "Enter your order number").max(40),
  phone: storefrontPhone,
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().email("Enter a valid email").optional()
  ),
});

export type CatalogueQuery = z.infer<typeof catalogueQuery>;
export type StorefrontQuoteInput = z.infer<typeof storefrontQuoteSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type StorefrontAddressInput = z.infer<typeof storefrontAddressSchema>;
