import { z } from "zod";

export const idParam = z.object({ id: z.string().min(1, "Missing id") });
export const numericIdParam = z.object({
  id: z.coerce.number().int().positive("Invalid id"),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const sortQuery = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const dateRangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/** Treats "", "all" and undefined as "no filter". */
export const optionalFilter = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (v === "" || v === "all" || v === null ? undefined : v),
    schema.optional()
  );

export const money = z.coerce
  .number()
  .min(0, "Must be zero or more")
  .max(99_999_999, "Value is too large")
  .refine((n) => Number.isFinite(n), "Invalid amount");

export const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  money.optional()
);

export const quantity = z.coerce.number().int().min(0, "Must be zero or more");

export const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number");

export const emailOptional = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().trim().email("Enter a valid email").optional()
);
