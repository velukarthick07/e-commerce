import { z } from "zod";
import { emailOptional, optionalFilter, paginationQuery, phone } from "./common.validator";

export const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(40).default("Home"),
  line1: z.string().trim().min(3, "Address is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  postalCode: z.string().trim().regex(/^\d{4,10}$/, "Enter a valid postal code"),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone,
  email: emailOptional,
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  addresses: z.array(addressSchema).max(10).default([]),
});

export const updateCustomerSchema = createCustomerSchema.partial();

/** Minimal payload used by "+ New Customer" inside the local-order screen. */
export const quickCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  phone,
  email: emailOptional,
  line1: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
});

export const listCustomersQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  isActive: optionalFilter(z.enum(["true", "false"])),
  sortBy: optionalFilter(z.enum(["name", "createdAt", "totalSpent", "totalOrders"])),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
