import { z } from "zod";
import {
  DeliveryType,
  OrderChannel,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/enums";
import {
  money,
  optionalFilter,
  paginationQuery,
  phone,
  emailOptional,
} from "./common.validator";

/**
 * Order line input. Deliberately carries no prices — the server re-reads the
 * current variant price from the database (spec: never trust client totals).
 */
export const orderItemInputSchema = z.object({
  variantId: z.string().min(1, "Variant is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(9999),
});

const newCustomerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required").max(120),
  phone,
  email: emailOptional,
});

export const createOrderSchema = z
  .object({
    customerId: z.string().min(1).optional(),
    newCustomer: newCustomerSchema.optional(),

    channel: z.enum(OrderChannel).default("LOCAL"),
    orderType: z.enum(OrderType),
    deliveryType: z.enum(DeliveryType).default("DELIVERY"),

    items: z
      .array(orderItemInputSchema)
      .min(1, "Add at least one product")
      .max(200, "Too many line items"),

    addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
    addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    state: z.string().trim().max(80).optional().or(z.literal("")),
    postalCode: z.string().trim().max(10).optional().or(z.literal("")),
    deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),

    couponCode: z.string().trim().toUpperCase().max(24).optional().or(z.literal("")),
    manualDiscount: money.default(0),
    deliveryCharge: money.default(0),

    paymentMethod: z.enum(PaymentMethod),
    paymentStatus: z.enum(PaymentStatus).default("PENDING"),
    transactionId: z.string().trim().max(120).optional().or(z.literal("")),

    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    status: z.enum(OrderStatus).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.customerId && !data.newCustomer) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Select an existing customer or add a new one",
      });
    }
    if (data.deliveryType === "DELIVERY") {
      if (!data.addressLine1?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["addressLine1"],
          message: "Delivery address is required for delivery orders",
        });
      }
      if (!data.city?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["city"],
          message: "City is required for delivery orders",
        });
      }
    }
    const ids = data.items.map((i) => i.variantId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "The same product variant appears more than once",
      });
    }
  });

/** Server-side preview of the very same calculation used on confirm. */
export const quoteOrderSchema = z.object({
  items: z.array(orderItemInputSchema).max(200).default([]),
  couponCode: z.string().trim().toUpperCase().max(24).optional().or(z.literal("")),
  manualDiscount: money.default(0),
  deliveryCharge: money.default(0),
});

export const listOrdersQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  status: optionalFilter(z.enum(OrderStatus)),
  channel: optionalFilter(z.enum(OrderChannel)),
  orderType: optionalFilter(z.enum(OrderType)),
  paymentStatus: optionalFilter(z.enum(PaymentStatus)),
  customerId: optionalFilter(z.string()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: optionalFilter(z.enum(["placedAt", "grandTotal", "orderNumber"])),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(OrderStatus),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(PaymentStatus),
  transactionId: z.string().trim().max(120).optional().or(z.literal("")),
  method: z.enum(PaymentMethod).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type QuoteOrderInput = z.infer<typeof quoteOrderSchema>;
