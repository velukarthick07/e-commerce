import { Client, staffLogin } from "./client.mjs";

const day = 86_400_000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function authScenarios(ctx) {
  const { baseUrl, report, admin, staff } = ctx;
  const M = "Auth";
  const anon = new Client(baseUrl, "anon");

  report.status(M, "wrong password is rejected", await anon.post("/api/auth/login", {
    email: ctx.accounts.admin.email, password: "NotTheRightOne1",
  }), 401);

  report.status(M, "unknown email is rejected", await anon.post("/api/auth/login", {
    email: "nobody@nowhere.local", password: "Whatever123",
  }), 401);

  report.status(M, "malformed login is a validation error", await anon.post("/api/auth/login", {
    email: "not-an-email", password: "x",
  }), 422);

  const me = await admin.get("/api/auth/me");
  report.check(M, "/auth/me returns the signed-in user with permissions",
    me.status === 200 && me.data?.email === ctx.accounts.admin.email && Array.isArray(me.data?.permissions),
    JSON.stringify(me.body).slice(0, 160));

  // Password reset. No email provider is wired up: the raw token is returned
  // in the response only outside production, so both paths are handled.
  const forgot = await anon.post("/api/auth/forgot-password", { email: ctx.accounts.staff.email });
  const unknownEmail = await anon.post("/api/auth/forgot-password", { email: "ghost@nowhere.local" });
  report.check(M, "forgot-password cannot be used to discover which emails exist",
    forgot.status === unknownEmail.status && forgot.message === unknownEmail.message,
    `known: ${forgot.status} "${forgot.message}" vs unknown: ${unknownEmail.status} "${unknownEmail.message}"`);

  const token = forgot.data?.resetToken ?? forgot.data?.token;
  report.check(M, "the reset token is withheld from the response in production",
    process.env.NODE_ENV === "production" ? !token : true);

  if (!token) {
    report.check(M, "reset flow skipped (token withheld by this build)", true);
  }

  if (token) {
    report.status(M, "reset-password rejects a bad token",
      await anon.post("/api/auth/reset-password", { token: "not-a-real-token", password: "Whatever123" }), [400, 404, 422]);

    const temp = "TempStaff2026";
    report.status(M, "reset-password accepts the issued token",
      await anon.post("/api/auth/reset-password", { token, password: temp }), 200);

    const relogin = await anon.post("/api/auth/login", { email: ctx.accounts.staff.email, password: temp });
    report.status(M, "the new password works", relogin, 200);

    // Put the seeded password back so the demo credentials keep working.
    const tempClient = await staffLogin(baseUrl, ctx.accounts.staff.email, temp, "staff-temp");
    report.status(M, "change-password restores the original",
      await tempClient.post("/api/auth/change-password", {
        currentPassword: temp, newPassword: ctx.accounts.staff.password, confirmPassword: ctx.accounts.staff.password,
      }), 200);
    report.status(M, "the restored password works",
      await anon.post("/api/auth/login", { email: ctx.accounts.staff.email, password: ctx.accounts.staff.password }), 200);
  }

  report.status(M, "change-password rejects a wrong current password",
    await staff.post("/api/auth/change-password", {
      currentPassword: "DefinitelyWrong1", newPassword: "Another12345", confirmPassword: "Another12345",
    }), [401, 422]);

  // Logout on a throwaway session, so the suite keeps its own.
  const throwaway = await staffLogin(baseUrl, ctx.accounts.staff.email, ctx.accounts.staff.password, "logout-probe");
  report.status(M, "logout succeeds", await throwaway.post("/api/auth/logout", {}), 200);
  report.status(M, "the session is dead after logout", await throwaway.get("/api/auth/me"), 401);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function userScenarios(ctx) {
  const { report, admin, manager, superAdmin, runId, baseUrl } = ctx;
  const M = "Users";

  const roles = await admin.get("/api/users/roles");
  report.check(M, "roles list returns all four roles", roles.status === 200 && roles.data?.length === 4,
    `got ${roles.data?.length}`);

  // One new user per role — left in place so every role is represented.
  const made = [];
  for (const [role, person] of Object.entries({
    SUPER_ADMIN: "Aarthi Ramanathan",
    ADMIN: "Dinesh Kumaran",
    MANAGER: "Shalini Prakash",
    STAFF: "Mohan Raj",
  })) {
    const email = `${role.toLowerCase().replace("_", ".")}.${runId}@fmcg.local`;
    const result = await admin.post("/api/users", {
      name: person, email, phone: "044280012" + made.length, password: "QaPassw0rd2026",
      role, isActive: true,
    });
    report.status(M, `create a ${role} user`, result, 201);
    if (result.status === 201) {
      made.push({ id: result.data.id, email, role, name: person });
      report.record("users", `${person} (${role})`);
    }
  }
  ctx.created.users = made;

  report.status(M, "duplicate email is refused",
    await admin.post("/api/users", {
      name: "Clone", email: made[0]?.email ?? "x@y.z", password: "QaPassw0rd2026", role: "STAFF",
    }), 409);

  report.status(M, "weak password is refused",
    await admin.post("/api/users", {
      name: "Weak", email: `weak.${runId}@fmcg.local`, password: "short", role: "STAFF",
    }), 422);

  const staffUser = made.find((u) => u.role === "STAFF");
  if (staffUser) {
    report.status(M, "update a user's name",
      await admin.put(`/api/users/${staffUser.id}`, { name: "Mohan Raj (counter)" }), 200);

    // A deactivated account — a state the app needs to handle and show.
    const managerUser = made.find((u) => u.role === "MANAGER");
    report.status(M, "deactivate a user",
      await admin.put(`/api/users/${managerUser.id}`, { isActive: false }), 200);
    report.record("users", `${managerUser.name} — left deactivated`);

    const blocked = await new Client(baseUrl, "deactivated").post("/api/auth/login", {
      email: managerUser.email, password: "QaPassw0rd2026",
    });
    report.status(M, "a deactivated user cannot sign in", blocked, [401, 403]);

    const newStaff = await staffLogin(baseUrl, staffUser.email, "QaPassw0rd2026", "new-staff");
    report.check(M, "a newly created user can sign in and gets the right role",
      newStaff.role === "STAFF", `got ${newStaff.role}`);
  }

  // Delete is Super Admin only; prove it works, on a user made for the purpose.
  const disposable = await admin.post("/api/users", {
    name: "Temp Auditor", email: `temp.auditor.${runId}@fmcg.local`, password: "QaPassw0rd2026", role: "STAFF",
  });
  if (disposable.status === 201) {
    report.status(M, "admin cannot delete a user", await admin.del(`/api/users/${disposable.data.id}`), 403);
    report.status(M, "super admin can delete a user", await superAdmin.del(`/api/users/${disposable.data.id}`), 200);
  }

  report.status(M, "manager can read the user list", await manager.get("/api/users"), 200);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function categoryScenarios(ctx) {
  const { report, admin, manager } = ctx;
  const M = "Categories";

  const parent = await admin.post("/api/categories", {
    name: `Beverages ${ctx.runId}`, description: "Teas, coffees and health drinks", sortOrder: 8,
  });
  report.status(M, "create a top-level category", parent, 201);
  if (parent.status !== 201) return;
  report.record("categories", parent.data.name);
  ctx.created.categoryParent = parent.data.id;

  const children = [];
  for (const name of ["Tea & Coffee", "Health Drinks"]) {
    const child = await admin.post("/api/categories", {
      name: `${name} ${ctx.runId}`, parentId: parent.data.id,
    });
    report.status(M, `create the "${name}" subcategory`, child, 201);
    if (child.status === 201) {
      children.push(child.data.id);
      report.record("categories", child.data.name);
    }
  }
  ctx.created.categoryChildren = children;

  report.status(M, "update a category",
    await admin.put(`/api/categories/${parent.data.id}`, {
      name: `Beverages ${ctx.runId}`, description: "Teas, coffees, health drinks and infusions",
    }), 200);

  const tree = await admin.get("/api/categories/tree");
  const found = JSON.stringify(tree.data ?? []).includes(`Beverages ${ctx.runId}`);
  report.check(M, "the new branch appears in the category tree", tree.status === 200 && found);

  report.status(M, "manager can create a category",
    await manager.post("/api/categories", { name: `Seasonal ${ctx.runId}` }), 201);

  // Deleting a category that still has products must be refused.
  const withProducts = await admin.get("/api/categories?limit=100");
  const occupied = (withProducts.data ?? []).find((c) => (c.productCount ?? 0) > 0);
  if (occupied) {
    report.status(M, "a category with products cannot be deleted",
      await admin.del(`/api/categories/${occupied.id}`), [409, 422]);
  }

  const spare = await admin.post("/api/categories", { name: `Disposable ${ctx.runId}` });
  if (spare.status === 201) {
    report.status(M, "an empty category can be deleted", await admin.del(`/api/categories/${spare.data.id}`), 200);
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function productScenarios(ctx) {
  const { report, admin, manager, runId } = ctx;
  const M = "Products";
  const categoryId = ctx.created.categoryParent;
  const [teaCat, drinksCat] = ctx.created.categoryChildren ?? [];

  const blueprints = [
    {
      label: "multi-variant, featured",
      payload: {
        name: `Nilgiri Green Tea ${runId}`, sku: `QA-TEA-${runId}`, brand: "Hill Harvest",
        shortDescription: "Hand-picked, whole-leaf green tea from the Nilgiris",
        description: "Grown at 6,000 ft and rolled the same day it is picked.",
        categoryId, subcategoryId: teaCat, mrp: 320, sellingPrice: 299, taxRate: 5,
        unit: "pack", netQuantity: "100 g", isFeatured: true, isActive: true, productType: "FOOD",
        ingredients: "Whole leaf green tea", dietaryInfo: "Vegan", shelfLifeDays: 540,
        countryOfOrigin: "India", storageInstructions: "Store in a cool, dry place",
        variants: [
          { name: "100 g", sku: `QA-TEA-${runId}-100`, mrp: 320, sellingPrice: 299, isDefault: true, openingStock: 60, minStock: 12, maxStock: 400 },
          { name: "250 g", sku: `QA-TEA-${runId}-250`, mrp: 750, sellingPrice: 690, discountPrice: 650, openingStock: 30, minStock: 8, maxStock: 200, sortOrder: 1 },
        ],
      },
    },
    {
      label: "cold-pressed oil",
      payload: {
        name: `Cold Pressed Mustard Oil ${runId}`, sku: `QA-MUS-${runId}`, brand: "Vanam Naturals",
        shortDescription: "Wood-pressed mustard oil, unrefined",
        categoryId, mrp: 480, sellingPrice: 440, taxRate: 5, unit: "bottle", netQuantity: "1 L",
        productType: "OIL", oilType: "Mustard", extractionMethod: "COLD_PRESSED",
        packagingType: "Glass bottle", shelfLifeDays: 365, manufacturer: "Vanam Naturals Pvt Ltd",
        fssaiLicense: "10019064002855",
        variants: [
          { name: "500 ml", sku: `QA-MUS-${runId}-500`, mrp: 260, sellingPrice: 240, isDefault: true, openingStock: 40, minStock: 10, maxStock: 300 },
          { name: "1 L", sku: `QA-MUS-${runId}-1L`, mrp: 480, sellingPrice: 440, openingStock: 25, minStock: 6, maxStock: 150, sortOrder: 1 },
        ],
      },
    },
    {
      label: "inactive — not for sale",
      payload: {
        name: `Herbal Hand Wash ${runId}`, sku: `QA-HW-${runId}`, brand: "Naattu Suvai",
        categoryId, subcategoryId: drinksCat ?? null, mrp: 180, sellingPrice: 165, taxRate: 18,
        unit: "bottle", netQuantity: "250 ml", productType: "PERSONAL_CARE", fragrance: "Neem & tulsi",
        isActive: false,
        variants: [{ name: "250 ml", sku: `QA-HW-${runId}-250`, mrp: 180, sellingPrice: 165, isDefault: true, openingStock: 20 }],
      },
    },
  ];

  const products = [];
  for (const bp of blueprints) {
    const result = await admin.post("/api/products", bp.payload);
    report.status(M, `create a product (${bp.label})`, result, 201);
    if (result.status === 201) {
      products.push(result.data);
      report.record("products", `${result.data.name} (${bp.label})`);
    }
  }
  ctx.created.products = products;

  report.status(M, "duplicate SKU is refused",
    await admin.post("/api/products", { ...blueprints[0].payload, name: "Clone" }), [409, 422]);

  report.status(M, "selling price above MRP is refused",
    await admin.post("/api/products", {
      ...blueprints[0].payload, sku: `QA-BAD-${runId}`, name: `Bad Price ${runId}`,
      mrp: 100, sellingPrice: 200,
      variants: [{ name: "1", sku: `QA-BAD-${runId}-1`, mrp: 100, sellingPrice: 200 }],
    }), 422);

  if (products[0]) {
    // A full edit goes through PUT with the whole product, variants included.
    const full = { ...blueprints[0].payload, sellingPrice: 289 };
    full.variants = full.variants.map((v, i) => ({ ...v, id: products[0].variants[i]?.id }));
    report.status(M, "update a product's price", await admin.put(`/api/products/${products[0].id}`, full), 200);

    const detail = await admin.get(`/api/products/${products[0].id}`);
    report.check(M, "the update is persisted", Number(detail.data?.sellingPrice) === 289,
      `got ${detail.data?.sellingPrice}`);

    report.status(M, "PATCH deactivates a product",
      await admin.patch(`/api/products/${products[0].id}`, { isActive: false }), 200);
    report.status(M, "PATCH activates it again",
      await admin.patch(`/api/products/${products[0].id}`, { isActive: true }), 200);
    report.status(M, "PATCH refuses a field it cannot change, rather than silently ignoring it",
      await admin.patch(`/api/products/${products[0].id}`, { sellingPrice: 1 }), 400);

    const search = await admin.get(`/api/products/search?q=${encodeURIComponent("Nilgiri Green Tea")}`);
    report.check(M, "product search finds it", (search.data ?? []).some((p) => p.id === products[0].id));
  }

  const brands = await admin.get("/api/products/brands");
  report.check(M, "brand list is returned", brands.status === 200 && Array.isArray(brands.data));

  report.status(M, "manager can deactivate a product",
    await manager.patch(`/api/products/${products[0]?.id}`, { isActive: false }), 200);
  await admin.patch(`/api/products/${products[0]?.id}`, { isActive: true });

  // Prove delete works without losing any of the catalogue we just built.
  const disposable = await admin.post("/api/products", {
    name: `Disposable Product ${runId}`, sku: `QA-DEL-${runId}`, categoryId,
    mrp: 50, sellingPrice: 45, variants: [{ name: "unit", sku: `QA-DEL-${runId}-1`, mrp: 50, sellingPrice: 45 }],
  });
  if (disposable.status === 201) {
    report.status(M, "manager cannot delete a product", await manager.del(`/api/products/${disposable.data.id}`), 403);
    report.status(M, "admin can delete a product", await admin.del(`/api/products/${disposable.data.id}`), 200);
  }
}

// ---------------------------------------------------------------------------
// Inventory, batches and expiry
// ---------------------------------------------------------------------------

export async function inventoryScenarios(ctx) {
  const { report, admin, manager, staff, runId } = ctx;
  const M = "Inventory";
  const tea = ctx.created.products?.[0];
  const oil = ctx.created.products?.[1];
  if (!tea || !oil) return report.check(M, "products available to stock", false, "product creation failed");

  const teaVariant = tea.variants[0];
  const oilVariant = oil.variants[0];

  // Batches covering every expiry bucket the app reports on.
  const batches = [
    { label: "already expired", variantId: oil.variants[1].id, expiryDate: iso(-12), quantity: 8 },
    { label: "expiring within 7 days", variantId: teaVariant.id, expiryDate: iso(5), quantity: 15 },
    { label: "expiring within 30 days", variantId: teaVariant.id, expiryDate: iso(22), quantity: 25 },
    { label: "expiring within 60 days", variantId: oilVariant.id, expiryDate: iso(48), quantity: 20 },
    { label: "long-dated", variantId: oilVariant.id, expiryDate: iso(300), quantity: 30 },
    { label: "no expiry date", variantId: tea.variants[1].id, expiryDate: null, quantity: 12 },
  ];

  const madeBatches = [];
  for (const [index, batch] of batches.entries()) {
    const result = await admin.post("/api/inventory/batches", {
      variantId: batch.variantId,
      batchNumber: `QA-${runId}-${String(index + 1).padStart(2, "0")}`,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate,
      manufacturingDate: iso(-60),
      purchasePrice: 120, mrp: 320, sellingPrice: 299,
    });
    report.status(M, `add a batch (${batch.label})`, result, 201);
    if (result.status === 201) {
      madeBatches.push({ id: result.data.id, ...batch });
      report.record("inventory batches", `${result.data.batchNumber} — ${batch.label}`);
    }
  }
  ctx.created.batches = madeBatches;

  report.status(M, "a batch expiring before it was made is refused",
    await admin.post("/api/inventory/batches", {
      variantId: teaVariant.id, batchNumber: `QA-BAD-${runId}`, quantity: 5,
      manufacturingDate: iso(10), expiryDate: iso(-10),
    }), 422);

  // Stock adjustments — one of each ledger type.
  for (const [type, label, qty] of [
    ["STOCK_ADDED", "goods received", 10],
    ["STOCK_REMOVED", "damaged in transit", 3],
    ["MANUAL_ADJUSTMENT", "stock count correction", 2],
  ]) {
    const result = await admin.post("/api/inventory/adjust", {
      variantId: teaVariant.id, type, quantity: qty, note: `QA ${label}`,
    });
    report.status(M, `adjust stock — ${type}`, result, 200);
    if (result.status === 200) report.record("stock adjustments", `${type} ×${qty} (${label})`);
  }

  report.status(M, "ORDER_DEDUCTION cannot be posted by hand",
    await admin.post("/api/inventory/adjust", {
      variantId: teaVariant.id, type: "ORDER_DEDUCTION", quantity: 1,
    }), 422);

  report.status(M, "removing more than is on hand is refused",
    await admin.post("/api/inventory/adjust", {
      variantId: teaVariant.id, type: "STOCK_REMOVED", quantity: 999_999,
    }), 422);

  report.status(M, "set min/max stock levels",
    await admin.patch("/api/inventory/min-max", { variantId: teaVariant.id, minStock: 15, maxStock: 500 }), 200);

  // Write off the expired batch — the EXPIRED_STOCK ledger scenario.
  const expired = madeBatches.find((b) => b.label === "already expired");
  if (expired) {
    const writeOff = await admin.post("/api/inventory/expiry/write-off", {
      batchId: expired.id, note: "QA expiry write-off",
    });
    report.status(M, "write off an expired batch", writeOff, 200);
    if (writeOff.status === 200) report.record("stock adjustments", "EXPIRED_STOCK write-off");
  }

  const expiryView = await admin.get("/api/inventory/expiry");
  report.check(M, "expiry view returns bucket counts and the batch list",
    expiryView.status === 200 && Array.isArray(expiryView.data?.batches) && Boolean(expiryView.data?.summary),
    JSON.stringify(expiryView.data ?? {}).slice(0, 140));

  for (const bucket of ["expired", "7_days", "30_days", "60_days", "normal"]) {
    const view = await admin.get(`/api/inventory/expiry?expiryBucket=${bucket}`);
    report.check(M, `expiry bucket "${bucket}" can be filtered`, view.status === 200);
  }

  const summary = await manager.get("/api/inventory/summary");
  report.check(M, "inventory summary aggregates live data",
    summary.status === 200 && typeof summary.data?.total === "number", JSON.stringify(summary.data).slice(0, 120));

  const ledger = await staff.get("/api/inventory/transactions?limit=5");
  report.check(M, "staff can read the stock ledger", ledger.status === 200 && Array.isArray(ledger.data));

  report.status(M, "staff cannot adjust stock",
    await staff.post("/api/inventory/adjust", { variantId: teaVariant.id, type: "STOCK_ADDED", quantity: 1 }), 403);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function customerScenarios(ctx) {
  const { report, admin, staff, manager } = ctx;
  const M = "Customers";

  const address = (label, line1, city, postalCode, isDefault = false) => ({
    label, line1, city, state: "Tamil Nadu", postalCode, isDefault,
  });

  const blueprints = [
    {
      label: "three addresses, one default",
      payload: {
        name: "Bhuvana Sekar", phone: ctx.phone(1), email: "bhuvana.sekar@example.com",
        notes: "Prefers evening delivery",
        addresses: [
          address("Home", "14 Kamarajar Street, Adambakkam", "Chennai", "600088", true),
          address("Work", "3rd Floor, Olympia Tech Park, Guindy", "Chennai", "600032"),
          address("Parents", "22 Bazaar Road, Thanjavur", "Thanjavur", "613001"),
        ],
      },
    },
    {
      label: "no address yet",
      payload: { name: "Ilango Murugesan", phone: ctx.phone(2), addresses: [] },
    },
    {
      label: "inactive account",
      payload: {
        name: "Dormant Traders", phone: ctx.phone(3), email: "dormant@example.com",
        isActive: false, notes: "Account on hold — unpaid balance",
        addresses: [address("Shop", "5 Market Lane", "Erode", "638001", true)],
      },
    },
  ];

  const customers = [];
  for (const bp of blueprints) {
    const result = await admin.post("/api/customers", bp.payload);
    report.status(M, `create a customer (${bp.label})`, result, 201);
    if (result.status === 201) {
      customers.push(result.data);
      report.record("customers", `${result.data.name} — ${bp.label}`);
    }
  }
  ctx.created.customers = customers;

  const multi = customers[0];
  if (multi) {
    report.check(M, "all three addresses were saved", multi.addresses?.length === 3,
      `got ${multi.addresses?.length}`);
    report.check(M, "exactly one address is the default",
      multi.addresses?.filter((a) => a.isDefault).length === 1);
  }

  report.status(M, "duplicate phone number is refused",
    await admin.post("/api/customers", { name: "Impostor", phone: ctx.phone(1) }), 409);

  report.status(M, "staff can create a customer",
    await staff.post("/api/customers", { name: "Counter Walk-in", phone: ctx.phone(4) }), 201);
  report.record("customers", "Counter Walk-in — created by STAFF");

  const quick = await staff.post("/api/customers/quick", {
    name: "Quick Add Shopper", phone: ctx.phone(5), city: "Chennai", state: "Tamil Nadu",
    line1: "9 Quick Street", postalCode: "600001",
  });
  report.status(M, "quick-create from the counter screen", quick, [200, 201]);
  if (quick.status < 300) report.record("customers", "Quick Add Shopper — quick create");

  // A repeat of the same number returns 200 (selected an existing customer)
  // rather than 201 (created one), so the counter is never blocked.
  const reused = await staff.post("/api/customers/quick", { name: "Anyone", phone: ctx.phone(5) });
  report.check(M, "quick-create reuses an existing phone number rather than failing",
    reused.status === 200 && reused.data?.id === quick.data?.id,
    `status ${reused.status}, ${reused.message}`);

  if (multi) {
    report.status(M, "staff can update a customer",
      await staff.put(`/api/customers/${multi.id}`, { notes: "Prefers evening delivery · confirmed" }), 200);
    report.status(M, "staff cannot delete a customer", await staff.del(`/api/customers/${multi.id}`), 403);
  }

  const search = await staff.get("/api/customers/search?q=Bhuvana");
  report.check(M, "customer type-ahead finds the new record",
    search.status === 200 && (search.data ?? []).some((c) => c.name === "Bhuvana Sekar"));

  const seeded = await admin.get("/api/customers?limit=100");
  const withOrders = (seeded.data ?? []).find((c) => (c.totalOrders ?? 0) > 0);
  if (withOrders) {
    report.status(M, "a customer with orders cannot be deleted",
      await admin.del(`/api/customers/${withOrders.id}`), [409, 422]);
    const history = await manager.get(`/api/customers/${withOrders.id}/orders`);
    report.check(M, "customer order history loads", history.status === 200 && Array.isArray(history.data));
  }

  const disposable = await admin.post("/api/customers", { name: "Disposable Contact", phone: ctx.phone(6) });
  if (disposable.status === 201) {
    report.status(M, "a customer with no orders can be deleted",
      await admin.del(`/api/customers/${disposable.data.id}`), 200);
  }
}
