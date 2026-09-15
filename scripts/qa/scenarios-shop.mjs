import { Client, customerLogin } from "./client.mjs";

/**
 * The customer-facing shop: browsing, guest checkout, OTP sign-in, the address
 * book, and order tracking — plus the boundaries that keep one shopper out of
 * another's data.
 */
export async function storefrontScenarios(ctx) {
  const { baseUrl, report, admin } = ctx;
  const M = "Storefront";
  const guest = new Client(baseUrl, "shopper");
  ctx.created.onlineOrders = [];

  // --- browsing -----------------------------------------------------------
  const store = await guest.get("/api/shop/store");
  report.check(M, "store details are public", store.status === 200 && Boolean(store.data?.storeName));

  const categories = await guest.get("/api/shop/categories");
  report.check(M, "category navigation is public", categories.status === 200 && (categories.data?.length ?? 0) > 0);

  const catalogue = await guest.get("/api/shop/catalogue?limit=40&inStockOnly=true");
  report.check(M, "catalogue lists in-stock products", catalogue.status === 200 && (catalogue.data?.length ?? 0) > 0);

  const inactiveShown = (catalogue.data ?? []).some((p) => p.name.startsWith("Herbal Hand Wash"));
  report.check(M, "a product marked inactive is hidden from shoppers", !inactiveShown);

  const leaks = JSON.stringify(catalogue.data ?? []);
  report.check(M, "the catalogue exposes no purchase prices or batch data",
    !/purchasePrice|batchNumber|minStock|maxStock/.test(leaks));

  const sorted = await guest.get("/api/shop/catalogue?sort=price_asc&limit=10");
  const prices = (sorted.data ?? []).map((p) => p.priceFrom);
  report.check(M, "price sorting is applied", prices.every((v, i, a) => i === 0 || a[i - 1] <= v));

  const searched = await guest.get("/api/shop/catalogue?search=oil");
  report.check(M, "catalogue search works", searched.status === 200 && (searched.data?.length ?? 0) > 0);

  const first = (catalogue.data ?? [])[0];
  const detail = await guest.get(`/api/shop/catalogue/${first.slug}`);
  report.check(M, "product detail loads with related items",
    detail.status === 200 && Array.isArray(detail.data?.related));
  report.status(M, "an unknown product slug is a 404", await guest.get("/api/shop/catalogue/no-such-product"), 404);

  // --- pricing ------------------------------------------------------------
  const pickable = (catalogue.data ?? []).flatMap((p) =>
    (p.variants ?? []).filter((v) => v.inStock && v.availableStock > 5).map((v) => ({ ...v, product: p.name }))
  );
  const a = pickable[0];
  const b = pickable[1];
  const items = [{ variantId: a.id, quantity: 2 }, { variantId: b.id, quantity: 1 }];
  const expected = a.effectivePrice * 2 + b.effectivePrice;

  const quote = await guest.post("/api/shop/quote", { items, deliveryType: "DELIVERY" });
  report.check(M, "the cart is priced by the server",
    quote.status === 200 && Math.abs(Number(quote.data.subtotal) - expected) < 0.01,
    `subtotal ${quote.data?.subtotal}, expected ${expected}`);

  const pickup = await guest.post("/api/shop/quote", { items, deliveryType: "PICKUP" });
  report.check(M, "store pickup removes the delivery charge",
    Number(pickup.data?.deliveryCharge) === 0 &&
      Number(quote.data.grandTotal) - Number(pickup.data.grandTotal) === Number(quote.data.deliveryCharge));

  // --- recognising a returning shopper ------------------------------------
  const unknown = await guest.post("/api/shop/lookup", { phone: "9000090000" });
  report.check(M, "an unknown number reveals nothing", unknown.data?.found === false);

  const known = ctx.created.customers?.[0];
  if (known) {
    const hint = await guest.post("/api/shop/lookup", { phone: known.phone });
    report.check(M, "a known number returns masked hints only",
      hint.data?.found === true && hint.data?.verified === false &&
        /•/.test(hint.data?.maskedName ?? "") && !JSON.stringify(hint.data).includes(known.name),
      JSON.stringify(hint.data).slice(0, 160));
  }

  report.status(M, "a malformed number is rejected", await guest.post("/api/shop/lookup", { phone: "123" }), 422);

  // --- guest checkout -----------------------------------------------------
  const guestPhone = ctx.phone(20);
  const guestOrder = await guest.post("/api/shop/orders", {
    items, name: "Sundar Ramesh", phone: guestPhone, email: "sundar.ramesh@example.com",
    deliveryType: "DELIVERY",
    address: { label: "Home", line1: "31 Lake View Road, Perungudi", city: "Chennai", state: "Tamil Nadu", postalCode: "600096", landmark: "Behind the water tank" },
    deliveryNotes: "Call before arriving", paymentMethod: "COD",
  });
  report.status(M, "a guest with no account can place an order", guestOrder, 201);
  if (guestOrder.status === 201) {
    ctx.created.onlineOrders.push(guestOrder.data);
    report.record("online orders", `${guestOrder.data.orderNumber} — guest checkout, delivery`);
    report.check(M, "the guest order starts unpaid and awaiting confirmation",
      guestOrder.data.status === "PENDING" && guestOrder.data.paymentStatus === "PENDING");
    report.check(M, "the landmark is carried into the delivery notes",
      (guestOrder.data.deliveryNotes ?? "").includes("Behind the water tank"));
  }

  // --- the shop cannot be talked into a discount --------------------------
  const tampered = await guest.post("/api/shop/orders", {
    items: [{ variantId: a.id, quantity: 1 }],
    name: "Chancer", phone: ctx.phone(21), deliveryType: "PICKUP", paymentMethod: "COD",
    grandTotal: 1, subtotal: 1, deliveryCharge: 0, paymentStatus: "PAID", status: "DELIVERED", manualDiscount: 9999,
  });
  if (tampered.status === 201) {
    // The counter app may open an order as DELIVERED; the shop may not.
    report.check(M, "client-supplied totals and status are ignored",
      Number(tampered.data.grandTotal) === a.effectivePrice &&
        tampered.data.paymentStatus === "PENDING" && tampered.data.status === "PENDING",
      `charged ${tampered.data.grandTotal} / ${tampered.data.status} / ${tampered.data.paymentStatus}`);
    ctx.created.onlineOrders.push(tampered.data);
    report.record("online orders", `${tampered.data.orderNumber} — price-tampering probe (charged correctly)`);
  }

  report.status(M, "ordering more than is in stock is refused",
    await guest.post("/api/shop/orders", {
      items: [{ variantId: a.id, quantity: 999_999 }],
      name: "Greedy", phone: ctx.phone(22), deliveryType: "PICKUP", paymentMethod: "COD",
    }), 422);

  report.status(M, "a payment method the shop has switched off is refused",
    await guest.post("/api/shop/orders", {
      items: [{ variantId: a.id, quantity: 1 }],
      name: "Card Payer", phone: ctx.phone(23), deliveryType: "PICKUP", paymentMethod: "CARD",
    }), 422);

  report.status(M, "a delivery order with no address is refused",
    await guest.post("/api/shop/orders", {
      items: [{ variantId: a.id, quantity: 1 }],
      name: "No Address", phone: ctx.phone(24), deliveryType: "DELIVERY", paymentMethod: "COD",
    }), 422);

  // --- tracking -----------------------------------------------------------
  if (guestOrder.status === 201) {
    const number = guestOrder.data.orderNumber;
    report.status(M, "tracking works with the order number and mobile",
      await guest.post("/api/shop/track", { orderNumber: number, phone: guestPhone }), 200);
    report.status(M, "tracking with the wrong mobile is refused",
      await guest.post("/api/shop/track", { orderNumber: number, phone: "9000000009" }), 404);
    report.status(M, "tracking an order number that does not exist is refused",
      await guest.post("/api/shop/track", { orderNumber: "ORD-19700101-0001", phone: guestPhone }), 404);

    const tracked = await guest.post("/api/shop/track", { orderNumber: number, phone: guestPhone });
    report.check(M, "tracking hides internal notes and batch data",
      !/statusHistory\":\[[^\]]*note/.test(JSON.stringify(tracked.data ?? {})) &&
        !/batchNumber/.test(JSON.stringify(tracked.data ?? {})));
  }

  // --- signing in ---------------------------------------------------------
  report.status(M, "signed-out shoppers cannot list orders", await guest.get("/api/shop/orders"), 401);
  report.status(M, "signed-out shoppers cannot read the address book", await guest.get("/api/shop/addresses"), 401);

  const otp = await guest.post("/api/shop/auth/otp", { phone: guestPhone });
  report.check(M, "a sign-in code can be requested", otp.status === 200 && Boolean(otp.data?.devCode));
  report.status(M, "a wrong code is rejected",
    await guest.post("/api/shop/auth/verify", { phone: guestPhone, code: "000000" }), 422);

  // The guest who just ordered signs in to the account their order created.
  const shopper = await customerLogin(baseUrl, guestPhone, "Sundar Ramesh");
  report.check(M, "a guest can sign in to the account their order created",
    shopper.customer?.phone === guestPhone);
  report.record("storefront customers", `${shopper.customer?.name} — ordered as a guest, then signed in`);

  const history = await shopper.get("/api/shop/orders");
  report.check(M, "their earlier guest order is in their history",
    history.status === 200 && (history.data ?? []).some((o) => o.orderNumber === guestOrder.data?.orderNumber));

  // A brand-new number has to supply a name before an account is made.
  const newPhone = ctx.phone(25);
  const fresh = new Client(baseUrl, "brand-new");
  const freshOtp = await fresh.post("/api/shop/auth/otp", { phone: newPhone });
  const needsName = await fresh.post("/api/shop/auth/verify", { phone: newPhone, code: freshOtp.data.devCode });
  report.check(M, "an unrecognised number is asked for a name instead of being signed in",
    needsName.data?.needsName === true && !fresh.cookies.fmcg_customer);
  const registered = await fresh.post("/api/shop/auth/verify", {
    phone: newPhone, code: freshOtp.data.devCode, name: "Kavitha Anand",
  });
  report.check(M, "supplying a name completes registration",
    registered.status === 200 && registered.data?.isNew === true && Boolean(fresh.cookies.fmcg_customer));
  if (registered.status === 200) report.record("storefront customers", "Kavitha Anand — registered via OTP");

  report.status(M, "a used code cannot be replayed",
    await fresh.post("/api/shop/auth/verify", { phone: newPhone, code: freshOtp.data.devCode }), 422);

  // --- the address book ---------------------------------------------------
  const addresses = [
    { label: "Home", line1: "12 Anna Salai", city: "Chennai", state: "Tamil Nadu", postalCode: "600002" },
    { label: "Work", line1: "Block C, DLF IT Park", city: "Chennai", state: "Tamil Nadu", postalCode: "600089", landmark: "Gate 2" },
    { label: "Other", line1: "7 Beach Road", city: "Puducherry", state: "Puducherry", postalCode: "605001", isDefault: true },
  ];
  // Checking out as a guest already saved that address against the new
  // account, so the book starts with one entry, not none.
  const existingBook = await shopper.get("/api/shop/addresses");
  const startedWith = (existingBook.data ?? []).length;
  report.check(M, "the address typed at guest checkout was kept on the new account", startedWith === 1,
    `started with ${startedWith}`);

  const saved = [];
  for (const address of addresses) {
    const result = await shopper.post("/api/shop/addresses", address);
    report.status(M, `save a "${address.label}" address`, result, 201);
    if (result.status === 201) saved.push(result.data);
  }
  report.record("storefront customers", `${shopper.customer?.name} — ${startedWith + saved.length} saved addresses`);

  const list = await shopper.get("/api/shop/addresses");
  report.check(M, "every saved address is returned",
    (list.data ?? []).length === startedWith + saved.length,
    `${(list.data ?? []).length} vs ${startedWith + saved.length}`);
  report.check(M, "exactly one address is the default",
    (list.data ?? []).filter((x) => x.isDefault).length === 1);

  const promoted = await shopper.post(`/api/shop/addresses/${saved[0].id}/default`);
  report.check(M, "promoting an address demotes the previous default",
    promoted.status === 200 && promoted.data.filter((x) => x.isDefault).length === 1 &&
      promoted.data.find((x) => x.id === saved[0].id)?.isDefault === true);

  report.status(M, "edit a saved address",
    await shopper.put(`/api/shop/addresses/${saved[1].id}`, { ...addresses[1], line1: "Block D, DLF IT Park" }), 200);

  report.status(M, "an invalid PIN code is refused",
    await shopper.put(`/api/shop/addresses/${saved[1].id}`, { ...addresses[1], postalCode: "abc" }), 422);

  const spare = await shopper.post("/api/shop/addresses", {
    label: "Other", line1: "1 Temporary Lane", city: "Chennai", state: "Tamil Nadu", postalCode: "600011",
  });
  report.status(M, "delete a saved address", await shopper.del(`/api/shop/addresses/${spare.data.id}`), 200);
  const afterDelete = await shopper.get("/api/shop/addresses");
  report.check(M, "a default address still exists after a deletion",
    (afterDelete.data ?? []).filter((x) => x.isDefault).length === 1);

  // --- ordering while signed in -------------------------------------------
  const signedInOrder = await shopper.post("/api/shop/orders", {
    items: [{ variantId: b.id, quantity: 2 }],
    name: shopper.customer.name, phone: guestPhone,
    deliveryType: "DELIVERY", addressId: saved[0].id, paymentMethod: "COD",
  });
  report.status(M, "a signed-in shopper can order to a saved address", signedInOrder, 201);
  if (signedInOrder.status === 201) {
    ctx.created.onlineOrders.push(signedInOrder.data);
    report.check(M, "the saved address is what gets delivered to",
      signedInOrder.data.addressLine1 === saved[0].line1);
    report.record("online orders", `${signedInOrder.data.orderNumber} — signed in, saved address`);
  }

  const pickupOrder = await shopper.post("/api/shop/orders", {
    items: [{ variantId: a.id, quantity: 1 }],
    name: shopper.customer.name, phone: guestPhone, deliveryType: "PICKUP", paymentMethod: "UPI",
  });
  report.status(M, "a signed-in shopper can choose store pickup", pickupOrder, 201);
  if (pickupOrder.status === 201) {
    ctx.created.onlineOrders.push(pickupOrder.data);
    report.check(M, "pickup orders carry no delivery charge", Number(pickupOrder.data.deliveryCharge) === 0);
    report.record("online orders", `${pickupOrder.data.orderNumber} — signed in, store pickup, UPI`);
  }

  // An online order that uses a coupon.
  const coupon = ctx.created.coupons?.["percentage with a cap"];
  if (coupon) {
    const big = pickable.find((v) => v.effectivePrice * 3 > 600) ?? a;
    const withCoupon = await shopper.post("/api/shop/orders", {
      items: [{ variantId: big.id, quantity: 3 }],
      name: shopper.customer.name, phone: guestPhone,
      deliveryType: "DELIVERY", addressId: saved[0].id, paymentMethod: "COD", couponCode: coupon.code,
    });
    report.status(M, "a coupon can be redeemed on the shop", withCoupon, 201);
    if (withCoupon.status === 201) {
      ctx.created.onlineOrders.push(withCoupon.data);
      report.check(M, "the coupon discount is applied", Number(withCoupon.data.discountTotal) > 0,
        `discount ${withCoupon.data.discountTotal}`);
      report.record("online orders", `${withCoupon.data.orderNumber} — ${coupon.code} redeemed`);
    }
  }

  // --- one shopper cannot reach another's data ----------------------------
  report.status(M, "another shopper's saved address cannot be used",
    await fresh.post("/api/shop/orders", {
      items: [{ variantId: a.id, quantity: 1 }], name: "Kavitha Anand", phone: newPhone,
      deliveryType: "DELIVERY", addressId: saved[0].id, paymentMethod: "COD",
    }), 404);

  report.status(M, "a guest cannot use a saved address at all",
    await new Client(baseUrl, "anon").post("/api/shop/orders", {
      items: [{ variantId: a.id, quantity: 1 }], name: "Anon", phone: ctx.phone(26),
      deliveryType: "DELIVERY", addressId: saved[0].id, paymentMethod: "COD",
    }), 422);

  report.status(M, "another shopper's order cannot be read",
    await fresh.get(`/api/shop/orders/${signedInOrder.data?.orderNumber}`), 404);

  report.status(M, "ordering under a different mobile while signed in is refused",
    await shopper.post("/api/shop/orders", {
      items: [{ variantId: a.id, quantity: 1 }], name: "Someone Else", phone: "9000011111",
      deliveryType: "PICKUP", paymentMethod: "COD",
    }), 422);

  // --- the profile --------------------------------------------------------
  report.status(M, "a shopper can update their own profile",
    await shopper.patch("/api/shop/profile", { name: "Sundar Ramesh", email: "sundar.r@example.com" }), 200);

  const me = await shopper.get("/api/shop/auth/me");
  report.check(M, "the profile change is persisted", me.data?.email === "sundar.r@example.com");

  report.status(M, "signing out ends the session", await shopper.post("/api/shop/auth/logout", {}), 200);
  report.status(M, "the session really is gone", await shopper.get("/api/shop/auth/me"), 401);

  // --- the shop's orders land in the admin --------------------------------
  const adminView = await admin.get("/api/orders?channel=ONLINE&limit=100");
  const placed = ctx.created.onlineOrders.map((o) => o.orderNumber);
  const visible = placed.filter((n) => (adminView.data ?? []).some((o) => o.orderNumber === n));
  report.check(M, "every shop order is visible to staff for dispatch",
    visible.length === placed.length, `${visible.length} of ${placed.length} visible`);

  if (placed.length) {
    const target = (adminView.data ?? []).find((o) => o.orderNumber === placed[0]);
    const detail = await admin.get(`/api/orders/${target.id}`);
    report.check(M, "staff see the shop order in full, with batch allocations",
      detail.status === 200 && (detail.data?.transactions?.length ?? 0) > 0);
    report.check(M, "a shop order is recorded as having no staff author",
      detail.data?.createdBy === null, `createdBy ${JSON.stringify(detail.data?.createdBy)}`);
  }
}
