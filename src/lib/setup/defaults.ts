import type { PrismaClient } from "@/generated/prisma/client";
import type { RoleName } from "@/generated/prisma/enums";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { hashPassword } from "@/lib/password";

/**
 * The rows a usable installation cannot start without: the permission
 * catalogue, the four roles, and one store-settings row.
 *
 * Both the setup wizard and `prisma/seed.ts` call these, so a new permission
 * added to ROLE_PERMISSIONS reaches a freshly installed server and a reseeded
 * demo database by the same path. Everything here is idempotent.
 */

export const ROLE_LABELS: Record<RoleName, { label: string; description: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    description: "Full access including user management and settings",
  },
  ADMIN: {
    label: "Admin",
    description: "Full operational access across the store",
  },
  MANAGER: {
    label: "Manager",
    description: "Day-to-day catalogue, inventory and order management",
  },
  STAFF: {
    label: "Staff",
    description: "Creates local orders and manages customers at the counter",
  },
};

/** Configuration blocks the admin can refine later under Settings. */
export const DEFAULT_SETTINGS_BLOCKS = {
  deliverySettings: {
    enableDelivery: true,
    enablePickup: true,
    defaultDeliveryCharge: 40,
    freeDeliveryAbove: 1000,
    maxDeliveryCharge: 500,
    deliveryRadiusKm: 12,
  },
  paymentSettings: { cash: true, card: true, upi: true, onlinePayment: false, cod: true },
  taxSettings: { taxEnabled: true, pricesIncludeTax: true, defaultTaxRate: 5 },
  orderSettings: {
    allowBackorders: false,
    blockExpiredStock: true,
    maxManualDiscountPercent: 20,
    lowStockAlert: true,
    autoConfirmLocalOrders: true,
  },
  notificationSettings: {
    lowStockEmails: true,
    expiryAlerts: true,
    newOrderAlerts: true,
    dailySummary: false,
  },
  securitySettings: { sessionTimeoutMinutes: 10080, enforceStrongPasswords: true },
  preferences: { dateFormat: "dd/MM/yyyy", rowsPerPage: 20, compactTables: false },
} as const;

/**
 * Writes the permission catalogue and the roles that reference it, then
 * reconciles each role's grants with ROLE_PERMISSIONS — including revoking
 * any grant that is no longer in the source of truth.
 */
export async function ensurePermissionsAndRoles(
  db: PrismaClient
): Promise<Map<RoleName, number>> {
  const keys = new Set<string>();
  for (const list of Object.values(ROLE_PERMISSIONS)) {
    list.forEach((key) => keys.add(key));
  }

  const permissionIds = new Map<string, number>();
  for (const key of keys) {
    const [resource, action] = key.split(":");
    const row = await db.permission.upsert({
      where: { resource_action: { resource, action } },
      update: {},
      create: { resource, action, description: `Can ${action} ${resource}` },
      select: { id: true },
    });
    permissionIds.set(key, row.id);
  }

  const roleIds = new Map<RoleName, number>();
  for (const [name, grants] of Object.entries(ROLE_PERMISSIONS) as [RoleName, string[]][]) {
    const meta = ROLE_LABELS[name];
    const role = await db.role.upsert({
      where: { name },
      update: { label: meta.label, description: meta.description },
      create: { name, label: meta.label, description: meta.description },
      select: { id: true },
    });
    roleIds.set(name, role.id);

    const wanted = grants.map((key) => permissionIds.get(key)!).filter(Boolean);

    await db.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: wanted } },
    });
    await db.rolePermission.createMany({
      data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  return roleIds;
}

export interface StoreSettingsInput {
  storeName: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  gstNumber?: string | null;
  fssaiLicense?: string | null;
  currency?: string;
  currencySymbol?: string;
  timezone?: string;
}

/** There is exactly one settings row, and its id is always 1. */
export async function ensureStoreSettings(
  db: PrismaClient,
  input: StoreSettingsInput
): Promise<void> {
  const data = {
    storeName: input.storeName,
    legalName: input.legalName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? "India",
    gstNumber: input.gstNumber ?? null,
    fssaiLicense: input.fssaiLicense ?? null,
    currency: input.currency ?? "INR",
    currencySymbol: input.currencySymbol ?? "₹",
    timezone: input.timezone ?? "Asia/Kolkata",
    ...DEFAULT_SETTINGS_BLOCKS,
  };

  await db.storeSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}

export interface AdministratorInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
}

/**
 * Creates the first administrator, as a SUPER_ADMIN.
 *
 * Refuses if any account already exists: this runs on an unauthenticated
 * endpoint, so "the database has no users" is the only thing standing between
 * a stranger and an admin account on somebody else's server.
 */
export async function createFirstAdministrator(
  db: PrismaClient,
  input: AdministratorInput,
  roleIds: Map<RoleName, number>
): Promise<{ id: number; email: string }> {
  const existing = await db.user.count();
  if (existing > 0) {
    throw new Error(
      "This database already has user accounts, so the first administrator cannot be created again."
    );
  }

  const roleId = roleIds.get("SUPER_ADMIN");
  if (!roleId) throw new Error("The SUPER_ADMIN role was not created.");

  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      passwordHash: await hashPassword(input.password),
      roleId,
      isActive: true,
    },
    select: { id: true, email: true },
  });

  return user;
}
