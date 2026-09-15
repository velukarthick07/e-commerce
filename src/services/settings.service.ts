import { settingsRepository } from "@/repositories/settings.repository";
import {
  deliverySettingsSchema,
  notificationSettingsSchema,
  orderSettingsSchema,
  paymentSettingsSchema,
  preferencesSchema,
  securitySettingsSchema,
  taxSettingsSchema,
  type UpdateStoreSettingsInput,
} from "@/validators/settings.validator";
import type { Prisma } from "@/generated/prisma/client";

/** Validates each JSON group against its schema before persisting. */
function buildJsonGroups(input: UpdateStoreSettingsInput, current: Awaited<ReturnType<typeof settingsRepository.get>>) {
  const groups: Record<string, unknown> = {};

  if (input.deliverySettings) {
    groups.deliverySettings = deliverySettingsSchema.parse({
      ...current.deliverySettings,
      ...input.deliverySettings,
    });
  }
  if (input.paymentSettings) {
    groups.paymentSettings = paymentSettingsSchema.parse({
      ...current.paymentSettings,
      ...input.paymentSettings,
    });
  }
  if (input.taxSettings) {
    groups.taxSettings = taxSettingsSchema.parse({
      ...current.taxSettings,
      ...input.taxSettings,
    });
  }
  if (input.orderSettings) {
    groups.orderSettings = orderSettingsSchema.parse({
      ...current.orderSettings,
      ...input.orderSettings,
    });
  }
  if (input.notificationSettings) {
    groups.notificationSettings = notificationSettingsSchema.parse({
      ...current.notificationSettings,
      ...input.notificationSettings,
    });
  }
  if (input.securitySettings) {
    groups.securitySettings = securitySettingsSchema.parse({
      ...current.securitySettings,
      ...input.securitySettings,
    });
  }
  if (input.preferences) {
    groups.preferences = preferencesSchema.parse({
      ...current.preferences,
      ...input.preferences,
    });
  }

  return groups as Prisma.StoreSettingsUpdateInput;
}

export const settingsService = {
  get: settingsRepository.get,

  async update(input: UpdateStoreSettingsInput) {
    const current = await settingsRepository.get();

    const scalars: Prisma.StoreSettingsUpdateInput = {};
    const scalarKeys = [
      "storeName",
      "legalName",
      "email",
      "phone",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "postalCode",
      "country",
      "gstNumber",
      "fssaiLicense",
      "logoUrl",
      "currency",
      "currencySymbol",
      "timezone",
    ] as const;

    for (const key of scalarKeys) {
      const value = input[key];
      if (value !== undefined) {
        (scalars as Record<string, unknown>)[key] = value === "" ? null : value;
      }
    }

    return settingsRepository.update({
      ...scalars,
      ...buildJsonGroups(input, current),
    });
  },
};
