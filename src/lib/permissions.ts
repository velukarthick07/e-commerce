import { RoleName } from "@/generated/prisma/enums";

export const RESOURCES = [
  "dashboard",
  "orders",
  "local-orders",
  "products",
  "categories",
  "customers",
  "inventory",
  "payments",
  "coupons",
  "reports",
  "settings",
  "users",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = "read" | "create" | "update" | "delete";

export type PermissionKey = `${Resource}:${Action}`;

const ALL: Action[] = ["read", "create", "update", "delete"];
const READ_ONLY: Action[] = ["read"];
const READ_WRITE: Action[] = ["read", "create", "update"];

function build(map: Partial<Record<Resource, Action[]>>): PermissionKey[] {
  const keys: PermissionKey[] = [];
  for (const [resource, actions] of Object.entries(map)) {
    for (const action of actions ?? []) {
      keys.push(`${resource as Resource}:${action}`);
    }
  }
  return keys;
}

/**
 * Source of truth for role capabilities. Seeded into the `permissions` /
 * `role_permissions` tables and enforced on every protected API route.
 */
export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: build({
    dashboard: READ_ONLY,
    orders: ALL,
    "local-orders": ALL,
    products: ALL,
    categories: ALL,
    customers: ALL,
    inventory: ALL,
    payments: ALL,
    coupons: ALL,
    reports: READ_ONLY,
    settings: ALL,
    users: ALL,
  }),
  ADMIN: build({
    dashboard: READ_ONLY,
    orders: ALL,
    "local-orders": ALL,
    products: ALL,
    categories: ALL,
    customers: ALL,
    inventory: ALL,
    payments: ALL,
    coupons: ALL,
    reports: READ_ONLY,
    settings: READ_WRITE,
    users: READ_WRITE,
  }),
  MANAGER: build({
    dashboard: READ_ONLY,
    orders: READ_WRITE,
    "local-orders": READ_WRITE,
    products: READ_WRITE,
    categories: READ_WRITE,
    customers: READ_WRITE,
    inventory: READ_WRITE,
    payments: READ_WRITE,
    coupons: READ_WRITE,
    reports: READ_ONLY,
    settings: READ_ONLY,
    users: READ_ONLY,
  }),
  STAFF: build({
    dashboard: READ_ONLY,
    orders: READ_ONLY,
    "local-orders": ["read", "create"],
    products: READ_ONLY,
    categories: READ_ONLY,
    customers: ["read", "create", "update"],
    inventory: READ_ONLY,
    payments: ["read", "create"],
    coupons: READ_ONLY,
    reports: [],
    settings: [],
    users: [],
  }),
};

export function permissionsForRole(role: RoleName): PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: RoleName, key: PermissionKey): boolean {
  return permissionsForRole(role).includes(key);
}

/** Sidebar visibility derives from `<resource>:read`. */
export function canAccessResource(role: RoleName, resource: Resource): boolean {
  return roleHasPermission(role, `${resource}:read`);
}
