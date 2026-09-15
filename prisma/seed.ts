import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import {
  ensurePermissionsAndRoles,
  ensureStoreSettings,
} from "@/lib/setup/defaults";
import { slugify, addDays, dateKey } from "@/lib/utils";
import { orderService } from "@/services/order.service";
import type { AuthSession } from "@/lib/auth";
import type { RoleName } from "@/generated/prisma/enums";
import { CATEGORY_TREE, COUPONS, CUSTOMERS, PRODUCTS } from "./seed-data";

/** Deterministic pseudo-random so reseeding produces the same demo data. */
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

async function reset() {
  console.log("• Clearing existing data…");
  // Children first so foreign keys never block the wipe.
  await prisma.inventoryTransaction.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.category.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.orderSequence.deleteMany();
  await prisma.storeSettings.deleteMany();
}

/**
 * Delegates to the same bootstrap the setup wizard runs, so a permission added
 * to ROLE_PERMISSIONS reaches a reseeded demo database and a freshly installed
 * server by exactly one code path.
 */
async function seedRolesAndPermissions() {
  console.log("• Seeding roles and permissions…");
  return ensurePermissionsAndRoles(prisma);
}

async function seedUsers(roleIds: Map<RoleName, number>) {
  console.log("• Seeding users…");

  const definitions: { role: RoleName; name: string; envEmail: string; envPassword: string; fallbackEmail: string; fallbackPassword: string; phone: string }[] = [
    { role: "SUPER_ADMIN", name: "Karthik Murugan", envEmail: "SEED_SUPER_ADMIN_EMAIL", envPassword: "SEED_SUPER_ADMIN_PASSWORD", fallbackEmail: "superadmin@fmcg.local", fallbackPassword: "SuperAdmin@123", phone: "9840100001" },
    { role: "ADMIN", name: "Vanitha Selvam", envEmail: "SEED_ADMIN_EMAIL", envPassword: "SEED_ADMIN_PASSWORD", fallbackEmail: "admin@fmcg.local", fallbackPassword: "Admin@123", phone: "9840100002" },
    { role: "MANAGER", name: "Arun Prakash", envEmail: "SEED_MANAGER_EMAIL", envPassword: "SEED_MANAGER_PASSWORD", fallbackEmail: "manager@fmcg.local", fallbackPassword: "Manager@123", phone: "9840100003" },
    { role: "STAFF", name: "Deepa Krishnan", envEmail: "SEED_STAFF_EMAIL", envPassword: "SEED_STAFF_PASSWORD", fallbackEmail: "staff@fmcg.local", fallbackPassword: "Staff@123", phone: "9840100004" },
  ];

  const created: { id: number; email: string; password: string; role: RoleName; name: string }[] = [];

  for (const def of definitions) {
    const email = process.env[def.envEmail] || def.fallbackEmail;
    const password = process.env[def.envPassword] || def.fallbackPassword;

    const user = await prisma.user.create({
      data: {
        name: def.name,
        email,
        phone: def.phone,
        passwordHash: await hashPassword(password),
        roleId: roleIds.get(def.role)!,
        isActive: true,
      },
      select: { id: true },
    });

    created.push({ id: user.id, email, password, role: def.role, name: def.name });
  }

  return created;
}

async function seedSettings() {
  console.log("• Seeding store settings…");
  await ensureStoreSettings(prisma, {
    storeName: "Naattu Suvai Foods",
    legalName: "Naattu Suvai Foods Private Limited",
    email: "hello@naattusuvai.local",
    phone: "04428001234",
    addressLine1: "18 Bazaar Street",
    addressLine2: "T Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "600017",
    country: "India",
    gstNumber: "33AABCN1234F1Z5",
    fssaiLicense: "12419008000123",
  });
}

async function seedCategories() {
  console.log("• Seeding categories…");
  const ids = new Map<string, number>();

  for (const [index, parent] of CATEGORY_TREE.entries()) {
    const parentRow = await prisma.category.create({
      data: { name: parent.name, slug: slugify(parent.name), sortOrder: index, isActive: true },
      select: { id: true },
    });
    ids.set(parent.name, parentRow.id);

    for (const [childIndex, child] of parent.children.entries()) {
      const childRow = await prisma.category.create({
        data: {
          name: child,
          slug: slugify(`${parent.name}-${child}`),
          parentId: parentRow.id,
          sortOrder: childIndex,
          isActive: true,
        },
        select: { id: true },
      });
      ids.set(`${parent.name}>${child}`, childRow.id);
    }
  }

  return ids;
}

/** Spreads expiry dates across the buckets the Expiry page filters on. */
function expiryForIndex(index: number, shelfLifeDays: number): Date {
  const bucket = index % 10;
  const today = new Date();
  if (bucket === 0) return addDays(today, -randInt(3, 40));          // expired
  if (bucket === 1 || bucket === 2) return addDays(today, randInt(2, 7));   // ≤ 7 days
  if (bucket === 3 || bucket === 4) return addDays(today, randInt(9, 30));  // ≤ 30 days
  if (bucket === 5) return addDays(today, randInt(32, 60));                  // ≤ 60 days
  return addDays(today, randInt(70, Math.max(80, shelfLifeDays)));           // normal
}

async function seedProducts(categoryIds: Map<string, number>, userId: number) {
  console.log("• Seeding products, variants, inventory and batches…");

  let batchCounter = 0;
  const variantIndex: { variantId: string; productId: string; sellingPrice: number }[] = [];

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category)!;
    const subcategoryId = product.subcategory
      ? categoryIds.get(`${product.category}>${product.subcategory}`) ?? null
      : null;

    const defaultVariant = product.variants[0];

    const createdProduct = await prisma.product.create({
      data: {
        name: product.name,
        slug: slugify(product.name),
        sku: product.sku,
        barcode: `890${String(Math.abs(hashCode(product.sku))).padStart(10, "0").slice(0, 10)}`,
        brand: product.brand,
        description: product.description,
        shortDescription: product.shortDescription,
        images: [],
        categoryId,
        subcategoryId,
        mrp: defaultVariant.mrp,
        sellingPrice: defaultVariant.sellingPrice,
        taxRate: product.taxRate,
        hsnCode: product.hsnCode ?? null,
        minStock: 10,
        maxStock: 1000,
        unit: product.unit,
        netQuantity: defaultVariant.name,
        isFeatured: product.isFeatured ?? false,
        isActive: true,
        productType: product.productType,
        ingredients: product.ingredients ?? null,
        nutritionalInfo: product.nutritionalInfo ?? undefined,
        allergens: product.allergens ?? null,
        dietaryInfo: product.dietaryInfo ?? null,
        storageInstructions: product.storageInstructions ?? null,
        shelfLifeDays: product.shelfLifeDays ?? null,
        countryOfOrigin: "India",
        manufacturer: `${product.brand} Foods`,
        packer: "Naattu Suvai Foods Pvt Ltd, Chennai",
        fssaiLicense: product.batched ? "12419008000123" : null,
        oilType: product.oilType ?? null,
        extractionMethod: product.extractionMethod ?? "NOT_APPLICABLE",
        packagingType: product.packagingType ?? null,
        fragrance: product.fragrance ?? null,
      },
      select: { id: true },
    });

    for (const [i, variant] of product.variants.entries()) {
      const sku = `${product.sku}-${variant.skuSuffix}`;

      const createdVariant = await prisma.productVariant.create({
        data: {
          productId: createdProduct.id,
          name: variant.name,
          sku,
          barcode: `890${String(Math.abs(hashCode(sku))).padStart(10, "0").slice(0, 10)}`,
          mrp: variant.mrp,
          sellingPrice: variant.sellingPrice,
          discountPrice: variant.discountPrice ?? null,
          weightGrams: variant.weightGrams ?? null,
          volumeMl: variant.volumeMl ?? null,
          isDefault: i === 0,
          isActive: true,
          sortOrder: i,
        },
        select: { id: true },
      });

      await prisma.inventory.create({
        data: {
          productId: createdProduct.id,
          variantId: createdVariant.id,
          currentStock: variant.stock,
          minStock: variant.minStock ?? 10,
          maxStock: 1000,
          lastRestockedAt: new Date(),
        },
      });

      await prisma.inventoryTransaction.create({
        data: {
          type: "STOCK_ADDED",
          productId: createdProduct.id,
          variantId: createdVariant.id,
          quantity: variant.stock,
          previousStock: 0,
          newStock: variant.stock,
          referenceType: "OPENING_STOCK",
          userId,
          note: "Opening stock",
        },
      });

      // Expiry-tracked products get their stock split across two batches so
      // FEFO has something meaningful to choose between.
      if (product.batched && variant.stock > 0) {
        const firstQty = Math.max(1, Math.floor(variant.stock * 0.4));
        const secondQty = variant.stock - firstQty;
        const shelfLife = product.shelfLifeDays ?? 180;

        const parts = [
          { qty: firstQty, expiry: expiryForIndex(batchCounter++, shelfLife) },
          { qty: secondQty, expiry: addDays(new Date(), randInt(90, Math.max(120, shelfLife))) },
        ].filter((p) => p.qty > 0);

        for (const [partIndex, part] of parts.entries()) {
          await prisma.inventoryBatch.create({
            data: {
              batchNumber: `B${dateKey(addDays(new Date(), -randInt(10, 120)))}-${String(batchCounter).padStart(3, "0")}${partIndex}`,
              productId: createdProduct.id,
              variantId: createdVariant.id,
              manufacturingDate: addDays(part.expiry, -shelfLife),
              expiryDate: part.expiry,
              bestBeforeDate: part.expiry,
              quantity: part.qty,
              remainingQuantity: part.qty,
              purchasePrice: Number((variant.sellingPrice * 0.7).toFixed(2)),
              mrp: variant.mrp,
              sellingPrice: variant.sellingPrice,
              receivedDate: addDays(new Date(), -randInt(5, 60)),
            },
          });
        }
      }

      variantIndex.push({
        variantId: createdVariant.id,
        productId: createdProduct.id,
        sellingPrice: variant.discountPrice ?? variant.sellingPrice,
      });
    }
  }

  return variantIndex;
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

async function seedCustomers() {
  console.log("• Seeding customers…");
  const ids: string[] = [];

  for (const customer of CUSTOMERS) {
    const row = await prisma.customer.create({
      data: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? null,
        isActive: true,
        addresses: {
          create: {
            label: "Home",
            line1: customer.line1,
            city: customer.city,
            state: customer.state,
            postalCode: customer.postalCode,
            isDefault: true,
          },
        },
      },
      select: { id: true },
    });
    ids.push(row.id);
  }

  return ids;
}

async function seedCoupons() {
  console.log("• Seeding coupons…");
  for (const coupon of COUPONS) {
    await prisma.coupon.create({
      data: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscount: coupon.maxDiscount,
        usageLimit: coupon.usageLimit,
        startsAt: addDays(new Date(), -30),
        expiresAt: addDays(new Date(), coupon.days),
        isActive: coupon.days > 0,
      },
    });
  }
}

const ORDER_TYPES_LOCAL = ["WALK_IN", "PHONE_ORDER", "WHATSAPP_ORDER", "LOCAL_DELIVERY", "STORE_PICKUP"] as const;
const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "COD"] as const;
const STATUS_FLOW = ["DELIVERED", "DELIVERED", "DELIVERED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "PENDING", "CONFIRMED", "CANCELLED"] as const;

/**
 * Creates orders through the real order service so the seed exercises the
 * same pricing, stock deduction and ledger code path the app uses.
 */
async function seedOrders(
  variants: { variantId: string; sellingPrice: number }[],
  customerIds: string[],
  users: { id: number; email: string; name: string; role: RoleName }[]
) {
  console.log("• Seeding orders (through the real order service)…");

  const staff = users.find((u) => u.role === "STAFF")!;
  const admin = users.find((u) => u.role === "ADMIN")!;

  const sessionFor = (u: typeof staff): AuthSession => ({
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    roleId: 0,
    permissions: [],
  });

  const perDay = new Map<string, number>();
  let created = 0;
  let failed = 0;

  for (let i = 0; i < 60; i += 1) {
    const daysAgo = Math.floor((i / 60) * 44);
    const placedAt = addDays(new Date(), -(44 - daysAgo));
    placedAt.setHours(randInt(9, 20), randInt(0, 59), 0, 0);

    const isLocal = rand() < 0.65;
    const itemCount = randInt(1, 4);
    const chosen = new Set<string>();
    const items: { variantId: string; quantity: number }[] = [];

    for (let n = 0; n < itemCount; n += 1) {
      const variant = pick(variants);
      if (chosen.has(variant.variantId)) continue;
      chosen.add(variant.variantId);
      items.push({ variantId: variant.variantId, quantity: randInt(1, 3) });
    }
    if (items.length === 0) continue;

    const deliveryType = isLocal && rand() < 0.4 ? "PICKUP" : "DELIVERY";
    const customer = pick(customerIds);
    const useCoupon = rand() < 0.25;

    try {
      const order = await orderService.create(
        {
          customerId: customer,
          channel: isLocal ? "LOCAL" : "ONLINE",
          orderType: isLocal ? pick([...ORDER_TYPES_LOCAL]) : "ONLINE_ORDER",
          deliveryType,
          items,
          addressLine1: deliveryType === "DELIVERY" ? "18 Bazaar Street" : "",
          city: deliveryType === "DELIVERY" ? "Chennai" : "",
          state: deliveryType === "DELIVERY" ? "Tamil Nadu" : "",
          postalCode: deliveryType === "DELIVERY" ? "600017" : "",
          couponCode: useCoupon ? "WELCOME10" : "",
          manualDiscount: rand() < 0.15 ? randInt(10, 40) : 0,
          deliveryCharge: deliveryType === "DELIVERY" ? 40 : 0,
          paymentMethod: pick([...PAYMENT_METHODS]),
          paymentStatus: rand() < 0.75 ? "PAID" : "PENDING",
          transactionId: "",
          notes: "",
          status: pick([...STATUS_FLOW]),
          newCustomer: undefined,
          deliveryNotes: "",
        },
        sessionFor(rand() < 0.6 ? staff : admin)
      );

      // Backdate the order and give it an order number matching that day.
      const key = dateKey(placedAt);
      const prefix = isLocal ? "LOC" : "ORD";
      const seq = (perDay.get(`${prefix}${key}`) ?? 0) + 1;
      perDay.set(`${prefix}${key}`, seq);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          placedAt,
          createdAt: placedAt,
          orderNumber: `${prefix}-${key}-${String(seq).padStart(4, "0")}`,
          ...(order.status === "DELIVERED" ? { deliveredAt: addDays(placedAt, 1) } : {}),
        },
      });
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { createdAt: placedAt },
      });
      await prisma.inventoryTransaction.updateMany({
        where: { orderId: order.id },
        data: { createdAt: placedAt },
      });

      created += 1;
    } catch (error) {
      // Stock can legitimately run out for a variant; skip and carry on.
      failed += 1;
      if (failed <= 3) {
        console.log(`  … skipped one order: ${(error as Error).message}`);
      }
    }
  }

  console.log(`  ${created} orders created${failed ? `, ${failed} skipped` : ""}`);
}

async function main() {
  console.log("\nSeeding FMCG admin database\n");

  await reset();
  const roleIds = await seedRolesAndPermissions();
  const users = await seedUsers(roleIds);
  await seedSettings();
  const categoryIds = await seedCategories();
  const variants = await seedProducts(categoryIds, users[0].id);
  const customerIds = await seedCustomers();
  await seedCoupons();
  await seedOrders(variants, customerIds, users);

  const [products, variantCount, orders, batches] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.order.count(),
    prisma.inventoryBatch.count(),
  ]);

  console.log("\n─────────────────────────────────────────────");
  console.log(` Categories : ${categoryIds.size}`);
  console.log(` Products   : ${products} (${variantCount} variants)`);
  console.log(` Batches    : ${batches}`);
  console.log(` Customers  : ${customerIds.length}`);
  console.log(` Orders     : ${orders}`);
  console.log("─────────────────────────────────────────────");
  console.log("\n Demo sign-in accounts:\n");
  for (const user of users) {
    console.log(`   ${user.role.padEnd(12)} ${user.email.padEnd(26)} ${user.password}`);
  }
  console.log("\n (Configure these via SEED_* variables in .env)\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
