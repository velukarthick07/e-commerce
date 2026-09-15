import { z } from "zod";
import { DiscountType } from "@/generated/prisma/enums";
import { money, optionalFilter, optionalMoney, paginationQuery } from "./common.validator";

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Code must be at least 3 characters")
      .max(24)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, - and _ only"),
    description: z.string().trim().max(300).optional().or(z.literal("")),
    discountType: z.enum(DiscountType),
    discountValue: money.refine((v) => v > 0, "Discount must be greater than zero"),
    minOrderValue: money.default(0),
    maxDiscount: optionalMoney,
    usageLimit: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(1, "Must allow at least one use").nullable()
    ),
    startsAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Percentage discount cannot exceed 100",
      });
    }
    if (data.startsAt && data.expiresAt && data.startsAt > data.expiresAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must be after the start date",
      });
    }
  });

export const updateCouponSchema = createCouponSchema;

export const listCouponsQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  isActive: optionalFilter(z.enum(["true", "false"])),
  status: optionalFilter(z.enum(["active", "expired", "scheduled", "exhausted"])),
});

export const validateCouponSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "Enter a coupon code"),
  subtotal: money,
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
