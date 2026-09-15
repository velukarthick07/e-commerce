import { z } from "zod";

const jsonGroup = z.record(z.string(), z.unknown());

export const updateStoreSettingsSchema = z.object({
  storeName: z.string().trim().min(2, "Store name is required").max(120).optional(),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().email("Enter a valid email").optional()
  ),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional(),
  gstNumber: z.string().trim().max(20).optional().or(z.literal("")),
  fssaiLicense: z.string().trim().max(30).optional().or(z.literal("")),
  logoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  currency: z.string().trim().max(5).optional(),
  currencySymbol: z.string().trim().max(3).optional(),
  timezone: z.string().trim().max(60).optional(),

  deliverySettings: jsonGroup.optional(),
  paymentSettings: jsonGroup.optional(),
  taxSettings: jsonGroup.optional(),
  orderSettings: jsonGroup.optional(),
  notificationSettings: jsonGroup.optional(),
  securitySettings: jsonGroup.optional(),
  preferences: jsonGroup.optional(),
});

/** Typed shapes for the JSON setting groups rendered by the Settings pages. */
export const deliverySettingsSchema = z.object({
  enableDelivery: z.boolean().default(true),
  enablePickup: z.boolean().default(true),
  defaultDeliveryCharge: z.coerce.number().min(0).default(40),
  freeDeliveryAbove: z.coerce.number().min(0).default(1000),
  maxDeliveryCharge: z.coerce.number().min(0).default(500),
  deliveryRadiusKm: z.coerce.number().min(0).default(10),
});

export const taxSettingsSchema = z.object({
  taxEnabled: z.boolean().default(true),
  pricesIncludeTax: z.boolean().default(true),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(5),
});

export const orderSettingsSchema = z.object({
  allowBackorders: z.boolean().default(false),
  blockExpiredStock: z.boolean().default(true),
  maxManualDiscountPercent: z.coerce.number().min(0).max(100).default(20),
  lowStockAlert: z.boolean().default(true),
  autoConfirmLocalOrders: z.boolean().default(true),
});

export const paymentSettingsSchema = z.object({
  cash: z.boolean().default(true),
  card: z.boolean().default(true),
  upi: z.boolean().default(true),
  onlinePayment: z.boolean().default(false),
  cod: z.boolean().default(true),
});

export const notificationSettingsSchema = z.object({
  lowStockEmails: z.boolean().default(true),
  expiryAlerts: z.boolean().default(true),
  newOrderAlerts: z.boolean().default(true),
  dailySummary: z.boolean().default(false),
});

export const securitySettingsSchema = z.object({
  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(10080).default(10080),
  enforceStrongPasswords: z.boolean().default(true),
});

export const preferencesSchema = z.object({
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]).default("dd/MM/yyyy"),
  rowsPerPage: z.coerce.number().int().min(5).max(100).default(20),
  compactTables: z.boolean().default(false),
});

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;
export type TaxSettings = z.infer<typeof taxSettingsSchema>;
export type OrderSettings = z.infer<typeof orderSettingsSchema>;
export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;
