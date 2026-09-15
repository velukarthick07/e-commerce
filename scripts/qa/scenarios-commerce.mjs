const day = 86_400_000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();

// ---------------------------------------------------------------------------
// Coupons — one of every state the app has to reason about
// ---------------------------------------------------------------------------

export async function couponScenarios(ctx) {
  const { report, admin, manager, runId } = ctx;
  const M = "Coupons";

  const blueprints = [
    { label: "percentage with a cap", code: `QAPCT${runId}`, discountType: "PERCENTAGE", discountValue: 15, minOrderValue: 500, maxDiscount: 150, description: "15% off, capped at ₹150" },
    { label: "flat amount", code: `QAFLAT${runId}`, discountType: "FIXED_AMOUNT", discountValue: 75, minOrderValue: 600, description: "₹75 off orders over ₹600" },
    { label: "high minimum order", code: `QABIG${runId}`, discountType: "PERCENTAGE", discountValue: 20, minOrderValue: 5000, description: "20% off orders over ₹5,000" },
    { label: "single use", code: `QAONCE${runId}`, discountType: "FIXED_AMOUNT", discountValue: 50, usageLimit: 1, description: "One use only" },
    { label: "already expired", code: `QAOLD${runId}`, discountType: "FIXED_AMOUNT", discountValue: 100, startsAt: iso(-60), expiresAt: iso(-2), description: "Expired promotion" },
    { label: "starts next week", code: `QASOON${runId}`, discountType: "PERCENTAGE", discountValue: 10, startsAt: iso(7), expiresAt: iso(37), description: "Upcoming promotion" },
    { label: "switched off", code: `QAOFF${runId}`, discountType: "FIXED_AMOUNT", discountValue: 40, isActive: false, description: "Paused promotion" },
  ];

  const coupons = {};
  for (const bp of blueprints) {
    const { label, ...payload } = bp;
    const result = await admin.post("/api/coupons", payload);
    report.status(M, `create a coupon (${label})`, result, 201);
    if (result.status === 201) {
      coupons[label] = result.data;
      report.record("coupons", `${result.data.code} — ${label}`);
    }
  }
  ctx.created.coupons = coupons;

  report.status(M, "duplicate coupon code is refused",
    await admin.post("/api/coupons", { code: `QAPCT${runId}`, discountType: "FIXED_AMOUNT", discountValue: 10 }), [409, 422]);

  report.status(M, "a percentage above 100 is refused",
    await admin.post("/api/coupons", { code: `QAMAD${runId}`, discountType: "PERCENTAGE", discountValue: 150 }), 422);

  // The validate endpoint should agree with each coupon's state.
  const cases = [
    ["percentage with a cap", 1000, true, "valid above the minimum"],
    ["percentage with a cap", 100, false, "below the minimum order value"],
    ["high minimum order", 1000, false, "below a high minimum"],
    ["already expired", 1000, false, "expired"],
    ["starts next week", 1000, false, "not started yet"],
    ["switched off", 1000, false, "inactive"],
  ];
  for (const [key, subtotal, shouldPass, description] of cases) {
    const coupon = coupons[key];
    if (!coupon) continue;
    const result = await admin.post("/api/coupons/validate", { code: coupon.code, subtotal });
    report.check(M, `validate ${coupon.code} — ${description}`,
      shouldPass ? result.status === 200 : result.status >= 400,
      `got ${result.status} ${result.message ?? ""}`);
  }

  const cap = coupons["percentage with a cap"];
  if (cap) {
    const capped = await admin.post("/api/coupons/validate", { code: cap.code, subtotal: 5000 });
    report.check(M, "the discount cap is applied (15% of ₹5,000 capped at ₹150)",
      capped.status === 200 && Number(capped.data?.discount) === 150, `got ${capped.data?.discount}`);
  }

  report.status(M, "manager can update a coupon",
    await manager.put(`/api/coupons/${coupons["flat amount"]?.id}`, {
      code: `QAFLAT${runId}`, discountType: "FIXED_AMOUNT", discountValue: 80, minOrderValue: 600,
      description: "₹80 off orders over ₹600",
    }), 200);

  const disposable = await admin.post("/api/coupons", { code: `QADEL${runId}`, discountType: "FIXED_AMOUNT", discountValue: 5 });
  if (disposable.status === 201) {
    report.status(M, "manager cannot delete a coupon", await manager.del(`/api/coupons/${disposable.data.id}`), 403);
    report.status(M, "admin can delete a coupon", await admin.del(`/api/coupons/${disposable.data.id}`), 200);
  }
}

// ---------------------------------------------------------------------------
// Local (counter) orders — every order type and payment method
// ---------------------------------------------------------------------------

export async function localOrderScenarios(ctx) {
  const { report, admin, manager, staff } = ctx;
  const M = "Local orders";

  const catalogue = await admin.get("/api/products?limit=30&isActive=true");
  const sellable = (catalogue.data ?? []).flatMap((p) =>
    (p.variants ?? [])
      .filter((v) => v.isActive && (v.inventory?.currentStock ?? 0) > 6)
      .map((v) => ({ variantId: v.id, price: Number(v.discountPrice ?? v.sellingPrice), product: p.name }))
  );
  if (sellable.length < 4) return report.check(M, "stock available to sell", false, `only ${sellable.length} sellable variants`);

  const customers = await admin.get("/api/customers?limit=50&isActive=true");
  const pool = (customers.data ?? []).filter((c) => c.addresses?.length);
  const pick = (i) => pool[i % pool.length];

  const address = (customer) => {
    const a = customer.addresses.find((x) => x.isDefault) ?? customer.addresses[0];
    return { addressLine1: a.line1, addressLine2: a.line2 ?? "", city: a.city, state: a.state, postalCode: a.postalCode };
  };

  const blueprints = [
    { label: "walk-in, paid in cash", actor: staff, orderType: "WALK_IN", deliveryType: "PICKUP", paymentMethod: "CASH", paymentStatus: "PAID", items: 1 },
    { label: "phone order, UPI, delivered to the door", actor: staff, orderType: "PHONE_ORDER", deliveryType: "DELIVERY", paymentMethod: "UPI", paymentStatus: "PAID", items: 2, withAddress: true },
    { label: "WhatsApp order, cash on delivery", actor: manager, orderType: "WHATSAPP_ORDER", deliveryType: "DELIVERY", paymentMethod: "COD", paymentStatus: "PENDING", items: 2, withAddress: true },
    { label: "store pickup, paid by card", actor: manager, orderType: "STORE_PICKUP", deliveryType: "PICKUP", paymentMethod: "CARD", paymentStatus: "PAID", items: 1 },
    { label: "local delivery with a coupon", actor: admin, orderType: "LOCAL_DELIVERY", deliveryType: "DELIVERY", paymentMethod: "CASH", paymentStatus: "PENDING", items: 3, withAddress: true, coupon: true },
    { label: "walk-in with a counter discount", actor: admin, orderType: "WALK_IN", deliveryType: "PICKUP", paymentMethod: "CASH", paymentStatus: "PAID", items: 2, manualDiscount: 25 },
  ];

  const orders = [];
  for (const [index, bp] of blueprints.entries()) {
    const customer = pick(index);
    const items = sellable.slice(index % 3, (index % 3) + bp.items).map((s) => ({ variantId: s.variantId, quantity: 1 + (index % 2) }));
    const payload = {
      customerId: customer.id,
      orderType: bp.orderType, deliveryType: bp.deliveryType,
      items,
      paymentMethod: bp.paymentMethod, paymentStatus: bp.paymentStatus,
      deliveryCharge: bp.deliveryType === "DELIVERY" ? 40 : 0,
      ...(bp.withAddress ? address(customer) : {}),
      ...(bp.manualDiscount ? { manualDiscount: bp.manualDiscount } : {}),
      ...(bp.coupon && ctx.created.coupons?.["flat amount"] ? { couponCode: ctx.created.coupons["flat amount"].code } : {}),
      notes: `QA scenario: ${bp.label}`,
    };

    const result = await bp.actor.post("/api/local-orders", payload);
    report.status(M, `place a local order — ${bp.label}`, result, 201);
    if (result.status === 201) {
      orders.push(result.data);
      report.record("local orders", `${result.data.orderNumber} — ${bp.label}`);
    }
  }
  ctx.created.localOrders = orders;

  // --- business rules -----------------------------------------------------
  const anyVariant = sellable[0].variantId;
  const customer = pick(0);

  report.status(M, "a manual discount above the configured cap is refused",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
      items: [{ variantId: anyVariant, quantity: 1 }], paymentMethod: "CASH", manualDiscount: 999_999,
    }), 422);

  report.status(M, "a delivery charge above the configured maximum is refused",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "LOCAL_DELIVERY", deliveryType: "DELIVERY",
      ...address(customer), items: [{ variantId: anyVariant, quantity: 1 }],
      paymentMethod: "CASH", deliveryCharge: 99_999,
    }), 422);

  report.status(M, "ordering more than is in stock is refused",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
      items: [{ variantId: anyVariant, quantity: 1_000_000 }], paymentMethod: "CASH",
    }), 422);

  report.status(M, "the same variant twice in one order is refused",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
      items: [{ variantId: anyVariant, quantity: 1 }, { variantId: anyVariant, quantity: 2 }],
      paymentMethod: "CASH",
    }), 422);

  report.status(M, "a delivery order with no address is refused",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "LOCAL_DELIVERY", deliveryType: "DELIVERY",
      items: [{ variantId: anyVariant, quantity: 1 }], paymentMethod: "CASH",
    }), 422);

  report.status(M, "an expired coupon is refused at the counter",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
      items: [{ variantId: anyVariant, quantity: 1 }], paymentMethod: "CASH",
      couponCode: ctx.created.coupons?.["already expired"]?.code,
    }), 422);

  // --- prices are the server's business ----------------------------------
  const unit = sellable[0].price;
  const tampered = await admin.post("/api/local-orders", {
    customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
    items: [{ variantId: anyVariant, quantity: 2, unitPrice: 1, lineTotal: 2 }],
    paymentMethod: "CASH", paymentStatus: "PAID",
    grandTotal: 2, subtotal: 2, taxAmount: 0, discountTotal: 999, status: "DELIVERED",
  });
  if (tampered.status === 201) {
    report.check(M, "client-supplied prices and totals are ignored",
      Number(tampered.data.grandTotal) === unit * 2 && Number(tampered.data.discountTotal) === 0,
      `charged ${tampered.data.grandTotal}, expected ${unit * 2}`);
    // Staff *may* open an order in a later status — a walk-in sale is complete
    // the moment it is rung up. The storefront cannot: see the shop suite,
    // where the same payload comes back PENDING.
    report.check(M, "staff may open an order at a later status (counter sale)",
      tampered.data.status === "DELIVERED", `status came back ${tampered.data.status}`);
    report.record("local orders", `${tampered.data.orderNumber} — counter sale opened as DELIVERED`);
    ctx.created.tamperProbe = tampered.data;
  }

  // Burn through a single-use coupon, so the database holds one in the
  // "usage limit reached" state and the rule that guards it is exercised.
  const once = ctx.created.coupons?.["single use"];
  if (once) {
    const redeemed = await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "PHONE_ORDER", deliveryType: "PICKUP",
      items: [{ variantId: anyVariant, quantity: 2 }], paymentMethod: "UPI", paymentStatus: "PAID",
      couponCode: once.code, notes: "QA scenario: redeeming a single-use coupon",
    });
    report.status(M, "a single-use coupon can be redeemed once", redeemed, 201);
    if (redeemed.status === 201) {
      report.check(M, "the discount was applied", Number(redeemed.data.couponDiscount) > 0,
        `discount ${redeemed.data.couponDiscount}`);
      ctx.created.localOrders.push(redeemed.data);
      report.record("local orders", `${redeemed.data.orderNumber} — redeemed ${once.code}`);
      report.record("coupons", `${once.code} — usage limit now reached`);
    }

    report.status(M, "the same coupon cannot be used a second time",
      await admin.post("/api/local-orders", {
        customerId: customer.id, orderType: "PHONE_ORDER", deliveryType: "PICKUP",
        items: [{ variantId: anyVariant, quantity: 1 }], paymentMethod: "CASH", couponCode: once.code,
      }), 422);
  }

  const quote = await staff.post("/api/orders/quote", { items: [{ variantId: anyVariant, quantity: 3 }] });
  report.check(M, "the counter quote matches the price actually charged",
    quote.status === 200 && Math.abs(Number(quote.data.grandTotal) - unit * 3) < 0.01,
    `quote ${quote.data?.grandTotal} vs ${unit * 3}`);

  report.status(M, "staff cannot change an order's status",
    await staff.patch(`/api/orders/${orders[0]?.id}/status`, { status: "CONFIRMED" }), 403);
}

// ---------------------------------------------------------------------------
// Order lifecycle — leave orders sitting in every status
// ---------------------------------------------------------------------------

export async function orderLifecycleScenarios(ctx) {
  const { report, admin, manager } = ctx;
  const M = "Order lifecycle";

  // Local orders auto-confirm on creation (a Settings option) while shop orders
  // start PENDING, so each order is walked on from wherever it actually is.
  const all = [...(ctx.created.localOrders ?? []), ...(ctx.created.onlineOrders ?? [])];
  const live = [];
  for (const order of all) {
    const detail = await admin.get(`/api/orders/${order.id}`);
    if (detail.status !== 200) continue;
    if (["CANCELLED", "RETURNED", "DELIVERED"].includes(detail.data.status)) continue;
    live.push(detail.data);
  }
  if (live.length < 6) return report.check(M, "orders available to progress", false, `only ${live.length}`);

  const FULL = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  const stepsTo = (from, to) => {
    const start = FULL.indexOf(from);
    const end = FULL.indexOf(to);
    return end <= start ? [] : FULL.slice(start + 1, end + 1);
  };

  const targets = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  let index = 0;
  /** Orders this pass actually moved — the ones whose history should show steps. */
  const walked = [];

  for (const target of targets) {
    const order = live[index++];
    if (!order) continue;
    const path = stepsTo(order.status, target);
    if (path.length === 0) {
      report.check(M, `an order already sits at ${target}`, order.status === target);
      report.record("orders left in status", `${order.orderNumber} → ${order.status}`);
      continue;
    }
    let ok = true;
    for (const status of path) {
      const result = await manager.patch(`/api/orders/${order.id}/status`, {
        status, note: `QA: moved to ${status.toLowerCase().replace(/_/g, " ")}`,
      });
      if (result.status !== 200) { ok = false; report.status(M, `${order.orderNumber} → ${status}`, result, 200); break; }
    }
    if (ok) {
      report.check(M, `walk an order from ${order.status} to ${target}`, true);
      report.record("orders left in status", `${order.orderNumber} → ${target}`);
      walked.push({ ...order, steps: path.length });
    }
  }

  // Cancellation must put the stock back on the shelf.
  const toCancel = live[index++];
  if (toCancel) {
    const line = toCancel.items?.[0];
    const before = await admin.get(`/api/inventory?search=${encodeURIComponent(line?.sku ?? "")}`);
    const qtyBefore = before.data?.[0]?.currentStock;

    report.status(M, "cancel an order",
      await admin.patch(`/api/orders/${toCancel.id}/status`, { status: "CANCELLED", note: "QA: customer changed their mind" }), 200);

    const after = await admin.get(`/api/inventory?search=${encodeURIComponent(line?.sku ?? "")}`);
    const qtyAfter = after.data?.[0]?.currentStock;
    report.check(M, "cancelling returns the stock to the shelf",
      typeof qtyBefore === "number" && qtyAfter === qtyBefore + (line?.quantity ?? 0),
      `${qtyBefore} → ${qtyAfter}, expected +${line?.quantity}`);
    report.record("orders left in status", `${toCancel.orderNumber} → CANCELLED`);

    report.status(M, "a cancelled order cannot be revived",
      await admin.patch(`/api/orders/${toCancel.id}/status`, { status: "CONFIRMED" }), 422);
  }

  // Delivered, then returned — the other path that restores stock.
  const toReturn = live[index++];
  if (toReturn) {
    let ok = true;
    for (const status of [...stepsTo(toReturn.status, "DELIVERED"), "RETURNED"]) {
      const result = await admin.patch(`/api/orders/${toReturn.id}/status`, { status, note: `QA: ${status}` });
      if (result.status !== 200) { ok = false; report.status(M, `${toReturn.orderNumber} → ${status}`, result, 200); break; }
    }
    if (ok) {
      report.check(M, "deliver an order and then take it back as a return", true);
      report.record("orders left in status", `${toReturn.orderNumber} → RETURNED`);
    }
  }

  report.status(M, "an impossible status jump is refused",
    await admin.patch(`/api/orders/${live[0].id}/status`, { status: "PENDING" }), 422);

  // Check the audit trail on an order this pass genuinely moved, not one that
  // was already sitting at its target.
  const longest = walked.sort((a, b) => b.steps - a.steps)[0] ?? live[0];
  const detail = await admin.get(`/api/orders/${longest.id}`);
  report.check(M, "the status history records every step",
    detail.status === 200 && (detail.data?.statusHistory?.length ?? 0) >= longest.steps + 1,
    `${detail.data?.statusHistory?.length} entries after ${longest.steps} moves`);
  report.check(M, "batch allocations are recorded against the order",
    (detail.data?.transactions?.length ?? 0) > 0);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function paymentScenarios(ctx) {
  const { report, admin, manager, staff } = ctx;
  const M = "Payments";
  const orders = ctx.created.localOrders ?? [];

  const unpaid = [];
  for (const order of orders) {
    const detail = await admin.get(`/api/orders/${order.id}`);
    if (detail.data?.paymentStatus === "PENDING") unpaid.push(detail.data);
  }

  if (unpaid[0]) {
    const result = await manager.patch(`/api/orders/${unpaid[0].id}/payment`, {
      paymentStatus: "PAID", transactionId: `QA-TXN-${ctx.runId}-1`,
    });
    report.status(M, "mark an order as paid", result, 200);
    report.check(M, "the order reflects the new payment status", result.data?.paymentStatus === "PAID");
    report.record("payments", `${unpaid[0].orderNumber} — marked PAID`);
  }

  // Pick a different payment method for the failure, so the data holds a
  // failed card/UPI payment rather than only failed cash.
  const failTarget = unpaid.find((o) => o.payments?.[0]?.method !== "CASH") ?? unpaid[1];
  if (failTarget) {
    const method = failTarget.payments?.[0]?.method ?? "unknown";
    report.status(M, `record a failed ${method} payment`,
      await manager.patch(`/api/orders/${failTarget.id}/payment`, { paymentStatus: "FAILED" }), 200);
    report.record("payments", `${failTarget.orderNumber} — FAILED (${method})`);
  }

  // A refund against a delivered, paid order.
  const paid = [];
  for (const order of orders) {
    const detail = await admin.get(`/api/orders/${order.id}`);
    if (detail.data?.paymentStatus === "PAID") paid.push(detail.data);
  }
  const refundTarget = paid.find((o) => o.payments?.[0]?.method !== "CASH") ?? paid[0];
  if (refundTarget) {
    const method = refundTarget.payments?.[0]?.method ?? "unknown";
    report.status(M, `refund a paid ${method} order`,
      await admin.patch(`/api/orders/${refundTarget.id}/payment`, { paymentStatus: "REFUNDED" }), 200);
    report.record("payments", `${refundTarget.orderNumber} — REFUNDED (${method})`);

    report.status(M, "setting the same payment status twice is refused",
      await admin.patch(`/api/orders/${refundTarget.id}/payment`, { paymentStatus: "REFUNDED" }), 422);
  }

  // A cash refund too, so both sides of the method split are represented.
  const cashRefund = paid.find((o) => o.payments?.[0]?.method === "CASH" && o.id !== refundTarget?.id);
  if (cashRefund) {
    report.status(M, "refund a paid cash order",
      await admin.patch(`/api/orders/${cashRefund.id}/payment`, { paymentStatus: "REFUNDED" }), 200);
    report.record("payments", `${cashRefund.orderNumber} — REFUNDED (CASH)`);
  }

  if (unpaid[2]) {
    const extra = await staff.post("/api/payments", {
      orderId: unpaid[2].id, amount: Number(unpaid[2].grandTotal), method: "UPI",
      status: "PAID", transactionId: `QA-TXN-${ctx.runId}-2`, notes: "QA: settled at the counter",
    });
    report.status(M, "staff can record a payment against an order", extra, 201);
    if (extra.status === 201) report.record("payments", `${unpaid[2].orderNumber} — second payment recorded by STAFF`);
  }

  for (const [status, label] of [["PAID", "paid"], ["PENDING", "pending"], ["REFUNDED", "refunded"], ["FAILED", "failed"]]) {
    const list = await manager.get(`/api/payments?status=${status}&limit=5`);
    report.check(M, `payments can be filtered by ${label}`, list.status === 200 && Array.isArray(list.data));
  }

  for (const method of ["CASH", "UPI", "CARD", "COD"]) {
    const list = await manager.get(`/api/payments?method=${method}&limit=5`);
    report.check(M, `payments can be filtered by ${method}`, list.status === 200);
  }

  report.status(M, "staff cannot change a payment's status",
    await staff.patch(`/api/orders/${orders[0]?.id}/payment`, { paymentStatus: "PAID" }), 403);
}

// ---------------------------------------------------------------------------
// Reports and settings
// ---------------------------------------------------------------------------

export async function reportScenarios(ctx) {
  const { report, manager, admin, staff } = ctx;
  const M = "Reports";

  const dashboard = await manager.get("/api/reports/dashboard");
  report.check(M, "dashboard loads with live figures",
    dashboard.status === 200 && dashboard.data && typeof dashboard.data === "object");

  for (const type of ["sales", "orders", "products", "customers", "payments", "local-orders", "inventory"]) {
    const json = await manager.get(`/api/reports/${type}?from=${iso(-90)}&to=${iso(1)}`);
    report.check(M, `${type} report returns data`, json.status === 200 && json.data !== undefined,
      `got ${json.status}`);

    const csv = await manager.call("GET", `/api/reports/${type}?format=csv&from=${iso(-90)}&to=${iso(1)}`);
    report.check(M, `${type} report exports as CSV`, csv.status === 200, `got ${csv.status}`);
  }

  report.status(M, "an unknown report type is rejected", await manager.get("/api/reports/nonsense"), [400, 404]);
  report.status(M, "staff cannot read reports", await staff.get("/api/reports/sales"), 403);
  report.check(M, "staff can still see the dashboard", (await staff.get("/api/reports/dashboard")).status === 200);
  report.check(M, "sales report groups by month", (await admin.get("/api/reports/sales?groupBy=month")).status === 200);
}

export async function settingsScenarios(ctx) {
  const { report, admin, manager, staff, superAdmin } = ctx;
  const M = "Settings";

  const current = await admin.get("/api/settings");
  report.check(M, "settings load", current.status === 200 && Boolean(current.data?.storeName));
  if (current.status !== 200) return;

  report.status(M, "manager can read settings", await manager.get("/api/settings"), 200);
  report.status(M, "staff cannot read settings", await staff.get("/api/settings"), 403);
  report.status(M, "manager cannot change settings",
    await manager.put("/api/settings", { storeName: "Manager Override" }), 403);
  report.status(M, "the settings payload is validated",
    await admin.put("/api/settings", { storeName: "" }), 422);

  // Only the groups being changed are sent — the read payload also carries
  // id/createdAt/updatedAt, which the update schema rightly rejects.
  const updated = await admin.put("/api/settings", {
    deliverySettings: { ...current.data.deliverySettings, defaultDeliveryCharge: 45, freeDeliveryAbove: 999 },
    orderSettings: { ...current.data.orderSettings, maxManualDiscountPercent: 20 },
  });
  report.status(M, "admin can change delivery settings", updated, 200);
  report.check(M, "the change is persisted",
    Number(updated.data?.deliverySettings?.defaultDeliveryCharge) === 45,
    `got ${updated.data?.deliverySettings?.defaultDeliveryCharge}`);

  const reread = await superAdmin.get("/api/settings");
  report.check(M, "the change is visible to another user",
    Number(reread.data?.deliverySettings?.freeDeliveryAbove) === 999);

  // Put the original delivery rules back so the demo behaves as documented.
  const restored = await admin.put("/api/settings", {
    deliverySettings: current.data.deliverySettings,
    orderSettings: current.data.orderSettings,
  });
  report.check(M, "settings restored to their documented defaults",
    Number(restored.data?.deliverySettings?.freeDeliveryAbove) === Number(current.data.deliverySettings.freeDeliveryAbove));
}

// ---------------------------------------------------------------------------
// Closing state — runs last, so nothing downstream disturbs what it leaves
// ---------------------------------------------------------------------------

export async function closingStateScenarios(ctx) {
  const { report, admin, runId } = ctx;
  const M = "Closing state";

  // Cancelling an order gives its coupon use back. The lifecycle phase
  // cancelled the order that redeemed the single-use coupon, so that coupon
  // should be spendable again.
  const once = ctx.created.coupons?.["single use"];
  if (once) {
    const after = await admin.get(`/api/coupons/${once.id}`);
    report.check(M, "cancelling an order releases the coupon use it consumed",
      Number(after.data?.usedCount) === 0,
      `usedCount is ${after.data?.usedCount} after the redeeming order was cancelled`);
  }

  // Leave one coupon genuinely exhausted, on an order that is finished and
  // will not be cancelled by anything.
  const coupon = await admin.post("/api/coupons", {
    code: `QAUSED${runId}`, discountType: "FIXED_AMOUNT", discountValue: 60,
    usageLimit: 1, description: "Single use — spent",
  });
  report.status(M, "create a single-use coupon", coupon, 201);
  if (coupon.status !== 201) return;

  const catalogue = await admin.get("/api/products?limit=20&isActive=true");
  const variant = (catalogue.data ?? [])
    .flatMap((p) => p.variants ?? [])
    .find((v) => v.isActive && (v.inventory?.currentStock ?? 0) > 4);
  const customers = await admin.get("/api/customers?limit=10&isActive=true");
  const customer = (customers.data ?? [])[0];
  if (!variant || !customer) return report.check(M, "stock and a customer to sell to", false);

  const order = await admin.post("/api/local-orders", {
    customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
    items: [{ variantId: variant.id, quantity: 2 }],
    paymentMethod: "CASH", paymentStatus: "PAID", couponCode: coupon.data.code,
    status: "DELIVERED", notes: "QA scenario: completed sale that spent a single-use coupon",
  });
  report.status(M, "spend the coupon on a completed sale", order, 201);
  if (order.status === 201) {
    report.record("local orders", `${order.data.orderNumber} — completed, spent ${coupon.data.code}`);
    report.record("coupons", `${coupon.data.code} — usage limit reached`);
  }

  const spent = await admin.get(`/api/coupons/${coupon.data.id}`);
  report.check(M, "the coupon is now at its usage limit",
    Number(spent.data?.usedCount) >= Number(spent.data?.usageLimit),
    `used ${spent.data?.usedCount} of ${spent.data?.usageLimit}`);

  report.status(M, "an exhausted coupon is refused",
    await admin.post("/api/local-orders", {
      customerId: customer.id, orderType: "WALK_IN", deliveryType: "PICKUP",
      items: [{ variantId: variant.id, quantity: 1 }], paymentMethod: "CASH",
      couponCode: coupon.data.code,
    }), 422);
}
