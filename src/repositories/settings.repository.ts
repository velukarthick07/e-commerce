import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  deliverySettingsSchema,
  notificationSettingsSchema,
  orderSettingsSchema,
  paymentSettingsSchema,
  preferencesSchema,
  securitySettingsSchema,
  taxSettingsSchema,
} from "@/validators/settings.validator";

const SINGLETON_ID = 1;

type StoreSettingsRow = Awaited<
  ReturnType<typeof prisma.storeSettings.create>
>;

/** Fills any missing JSON group with its schema defaults. */
function withDefaults(row: StoreSettingsRow) {
  return {
    ...row,
    deliverySettings: deliverySettingsSchema.parse(row.deliverySettings ?? {}),
    paymentSettings: paymentSettingsSchema.parse(row.paymentSettings ?? {}),
    taxSettings: taxSettingsSchema.parse(row.taxSettings ?? {}),
    orderSettings: orderSettingsSchema.parse(row.orderSettings ?? {}),
    notificationSettings: notificationSettingsSchema.parse(
      row.notificationSettings ?? {}
    ),
    securitySettings: securitySettingsSchema.parse(row.securitySettings ?? {}),
    preferences: preferencesSchema.parse(row.preferences ?? {}),
  };
}

export const settingsRepository = {
  /** Always returns a row — creates the singleton on first access. */
  async get() {
    const existing = await prisma.storeSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return withDefaults(existing);

    const created = await prisma.storeSettings.create({
      data: { id: SINGLETON_ID },
    });
    return withDefaults(created);
  },

  async update(data: Prisma.StoreSettingsUpdateInput) {
    const row = await prisma.storeSettings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...(data as Prisma.StoreSettingsCreateInput) },
    });
    return withDefaults(row);
  },
};

export type StoreSettingsResolved = Awaited<ReturnType<typeof settingsRepository.get>>;
