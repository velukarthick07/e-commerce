import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { AppError, BusinessRuleError, NotFoundError } from "@/lib/errors";
import { maskAddress, maskName, normalisePhone } from "@/lib/phone";
import { assertFound } from "@/lib/utils";
import type { CustomerSession } from "@/lib/customer-auth";
import { customerRepository } from "@/repositories/customer.repository";
import { settingsRepository } from "@/repositories/settings.repository";
import { storefrontRepository } from "@/repositories/storefront.repository";
import { orderService } from "./order.service";
import type { CalculatedOrder } from "./order-calculation";
import type {
  CatalogueQuery,
  PlaceOrderInput,
  StorefrontQuoteInput,
} from "@/validators/storefront.validator";
import type { CreateOrderInput } from "@/validators/order.validator";

/**
 * What the storefront exposes about an order. Deliberately narrower than the
 * admin projection: no batch allocations, no inventory ledger, no staff notes,
 * no internal status commentary.
 */
const publicOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  orderType: true,
  deliveryType: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  deliveryNotes: true,
  subtotal: true,
  discountTotal: true,
  taxAmount: true,
  deliveryCharge: true,
  grandTotal: true,
  couponCode: true,
  placedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  items: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      productName: true,
      variantName: true,
      imageUrl: true,
      mrp: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
      product: { select: { slug: true, unit: true } },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { method: true, status: true },
  },
  // Status + timestamp only. The `note` column carries internal staff
  // commentary and is not the shopper's business.
  statusHistory: {
    orderBy: { createdAt: "asc" },
    select: { status: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  deliveryType: true,
  grandTotal: true,
  placedAt: true,
  deliveredAt: true,
  items: {
    take: 3,
    orderBy: { createdAt: "asc" },
    select: { productName: true, variantName: true, imageUrl: true, quantity: true },
  },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

/** Live sellable quantity for a variant (what is on hand, less what is held). */
function available(inv: { currentStock: number; reservedStock: number } | null) {
  if (!inv) return 0;
  return Math.max(0, inv.currentStock - inv.reservedStock);
}

type VariantRow = {
  id: string;
  sellingPrice: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
  mrp: Prisma.Decimal;
  inventory: { currentStock: number; reservedStock: number } | null;
};

/**
 * Adds the derived fields a shop needs on top of the raw catalogue row:
 * the effective price, the saving against MRP, and stock availability.
 */
function decorateProduct<
  T extends { variants: VariantRow[]; name: string },
>(product: T) {
  const variants = product.variants.map((v) => {
    const price = Number(v.discountPrice ?? v.sellingPrice);
    const mrp = Number(v.mrp);
    const stock = available(v.inventory);
    return {
      ...v,
      effectivePrice: price,
      savings: Math.max(0, mrp - price),
      discountPercent: mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0,
      availableStock: stock,
      inStock: stock > 0,
    };
  });

  const sellable = variants.filter((v) => v.inStock);
  const priced = sellable.length > 0 ? sellable : variants;

  return {
    ...product,
    variants,
    priceFrom: priced.length ? Math.min(...priced.map((v) => v.effectivePrice)) : 0,
    priceTo: priced.length ? Math.max(...priced.map((v) => v.effectivePrice)) : 0,
    maxDiscountPercent: priced.length
      ? Math.max(...priced.map((v) => v.discountPercent))
      : 0,
    inStock: sellable.length > 0,
  };
}

/**
 * Delivery pricing, in one place so the figure quoted in the cart is provably
 * the figure charged at checkout — both paths call this.
 */
function deliveryChargeFor(
  deliveryType: "DELIVERY" | "PICKUP",
  merchandiseTotal: number,
  settings: { defaultDeliveryCharge: number; freeDeliveryAbove: number }
): number {
  if (deliveryType === "PICKUP") return 0;
  if (merchandiseTotal <= 0) return 0;
  if (settings.freeDeliveryAbove > 0 && merchandiseTotal >= settings.freeDeliveryAbove) {
    return 0;
  }
  return settings.defaultDeliveryCharge;
}

export interface StorefrontQuote extends CalculatedOrder {
  freeDeliveryAbove: number;
  amountToFreeDelivery: number;
}

async function priceCart(input: StorefrontQuoteInput): Promise<StorefrontQuote> {
  const settings = await settingsRepository.get();

  // Delivery is a flat addition to the total — it takes no part in discounts
  // or tax — so the cart is priced once at zero delivery and the charge is
  // decided from the resulting merchandise total.
  const base = await orderService.quote({
    items: input.items,
    couponCode: input.couponCode,
    manualDiscount: 0,
    deliveryCharge: 0,
  });

  const charge = deliveryChargeFor(
    input.deliveryType,
    base.grandTotal,
    settings.deliverySettings
  );

  const threshold = settings.deliverySettings.freeDeliveryAbove;
  return {
    ...base,
    deliveryCharge: charge,
    grandTotal: Number((base.grandTotal + charge).toFixed(2)),
    freeDeliveryAbove: threshold,
    amountToFreeDelivery:
      input.deliveryType === "PICKUP" || threshold <= 0 || base.grandTotal >= threshold
        ? 0
        : Number((threshold - base.grandTotal).toFixed(2)),
  };
}

export const storefrontService = {
  async catalogue(query: CatalogueQuery) {
    const { items, meta } = await storefrontRepository.listProducts(query);
    return { items: items.map(decorateProduct), meta };
  },

  async product(slug: string) {
    const product = assertFound(await storefrontRepository.findBySlug(slug), "Product");
    const related = await storefrontRepository.related(product.category.id, product.id);
    return {
      ...decorateProduct(product),
      related: related.map(decorateProduct),
    };
  },

  categories: storefrontRepository.categories,
  brands: storefrontRepository.brands,

  quote: priceCart,

  /** Payment methods the shop accepts online, from Settings. */
  async paymentOptions(): Promise<PaymentMethod[]> {
    const settings = await settingsRepository.get();
    const methods: PaymentMethod[] = [];
    if (settings.paymentSettings.cod) methods.push("COD");
    if (settings.paymentSettings.upi) methods.push("UPI");
    if (settings.paymentSettings.onlinePayment) methods.push("ONLINE_PAYMENT");
    // Never leave a shopper with nothing to pick.
    return methods.length > 0 ? methods : ["COD"];
  },

  async storeInfo() {
    const settings = await settingsRepository.get();
    return {
      storeName: settings.storeName,
      phone: settings.phone,
      email: settings.email,
      city: settings.city,
      state: settings.state,
      currencySymbol: settings.currencySymbol,
      delivery: {
        enableDelivery: settings.deliverySettings.enableDelivery,
        enablePickup: settings.deliverySettings.enablePickup,
        defaultDeliveryCharge: settings.deliverySettings.defaultDeliveryCharge,
        freeDeliveryAbove: settings.deliverySettings.freeDeliveryAbove,
      },
      paymentMethods: await this.paymentOptions(),
    };
  },

  /**
   * "Do we know this number?" for the checkout form.
   *
   * Returns hints only — a masked name and locality. Returning the real name
   * and address would turn an unauthenticated endpoint into a lookup service
   * for anyone who can guess a mobile number, so the full details are released
   * only after the OTP step (or when the operator opts out via
   * STOREFRONT_OPEN_AUTOFILL, see README).
   */
  async lookup(rawPhone: string) {
    const phone = normalisePhone(rawPhone);
    const customer = await customerRepository.findByPhone(phone);
    if (!customer || !customer.isActive) {
      return { found: false as const };
    }

    if (process.env.STOREFRONT_OPEN_AUTOFILL === "true") {
      return {
        found: true as const,
        verified: true as const,
        name: customer.name,
        email: customer.email,
        addresses: customer.addresses,
      };
    }

    const preferred =
      customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0] ?? null;

    return {
      found: true as const,
      verified: false as const,
      maskedName: maskName(customer.name),
      maskedAddress: preferred ? maskAddress(preferred) : null,
      addressCount: customer.addresses.length,
    };
  },

  /**
   * Places a storefront order. Runs through the same `orderService.create`
   * the counter app uses, so pricing, FEFO stock deduction, coupon accounting
   * and the ledger behave identically — this path just supplies no staff user.
   */
  async placeOrder(input: PlaceOrderInput, session: CustomerSession | null) {
    const settings = await settingsRepository.get();
    const phone = normalisePhone(input.phone);

    if (session && normalisePhone(session.phone) !== phone) {
      throw new BusinessRuleError(
        "You are signed in with a different mobile number. Sign out to order with this one."
      );
    }

    if (input.deliveryType === "DELIVERY" && !settings.deliverySettings.enableDelivery) {
      throw new BusinessRuleError("Home delivery is not available right now");
    }
    if (input.deliveryType === "PICKUP" && !settings.deliverySettings.enablePickup) {
      throw new BusinessRuleError("Store pickup is not available right now");
    }

    const allowedMethods = await this.paymentOptions();
    if (!allowedMethods.includes(input.paymentMethod)) {
      throw new BusinessRuleError(
        "That payment method is not available. Please choose another."
      );
    }

    // --- Resolve the address ------------------------------------------------
    let address: {
      line1: string;
      line2: string | null;
      city: string;
      state: string;
      postalCode: string;
      landmark: string | null;
      label: string;
    } | null = null;

    if (input.deliveryType === "DELIVERY") {
      if (input.addressId) {
        // A saved address may only be used by the customer who owns it, and
        // only when that ownership has been proven by signing in.
        if (!session) {
          throw new BusinessRuleError("Sign in to use a saved address");
        }
        const saved = await customerRepository.findAddress(
          input.addressId,
          session.customerId
        );
        if (!saved) throw new NotFoundError("Address");
        address = {
          line1: saved.line1,
          line2: saved.line2,
          city: saved.city,
          state: saved.state,
          postalCode: saved.postalCode,
          landmark: saved.landmark,
          label: saved.label,
        };
      } else if (input.address) {
        address = {
          line1: input.address.line1,
          line2: input.address.line2 || null,
          city: input.address.city,
          state: input.address.state,
          postalCode: input.address.postalCode,
          landmark: input.address.landmark || null,
          label: input.address.label,
        };
      }
      if (!address) throw new BusinessRuleError("A delivery address is required");
    }

    // --- Resolve the customer ----------------------------------------------
    const existing = await customerRepository.findByPhone(phone);
    const customerId = session?.customerId ?? existing?.id;
    const isNewCustomer = !customerId;

    if (existing && !existing.isActive) {
      throw new BusinessRuleError(
        "This account is on hold. Please contact the store to place an order."
      );
    }

    // --- Price it, then hand over to the shared order pipeline ---------------
    const quote = await priceCart({
      items: input.items,
      couponCode: input.couponCode,
      deliveryType: input.deliveryType,
    });

    const orderInput: CreateOrderInput = {
      ...(customerId
        ? { customerId }
        : {
            newCustomer: {
              name: input.name,
              phone,
              email: input.email,
            },
          }),
      channel: "ONLINE",
      orderType: "ONLINE_ORDER",
      deliveryType: input.deliveryType,
      items: input.items,
      addressLine1: address?.line1 ?? "",
      addressLine2: address?.line2 ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      postalCode: address?.postalCode ?? "",
      deliveryNotes: [input.deliveryNotes, address?.landmark && `Landmark: ${address.landmark}`]
        .filter(Boolean)
        .join(" · "),
      couponCode: input.couponCode,
      manualDiscount: 0,
      deliveryCharge: quote.deliveryCharge,
      paymentMethod: input.paymentMethod,
      // No payment gateway is wired up: an online order is always unpaid when
      // it lands, and staff mark it paid on collection or delivery.
      paymentStatus: "PENDING",
      notes: "",
      // Online orders wait for the shop to confirm them — that review step is
      // what the admin Orders screen exists for.
      status: "PENDING",
    };

    const order = await orderService.create(orderInput, null);

    // --- Address book upkeep ------------------------------------------------
    // Save the typed address for a signed-in customer who asked us to, and
    // always for a brand-new customer (it becomes their default). An
    // unauthenticated order against an *existing* customer never writes to
    // their address book — that would let anyone who knows the number add
    // entries to someone else's account.
    if (address && !input.addressId) {
      const owner = session?.customerId ?? (isNewCustomer ? order.customerId : null);
      if (owner && (session ? input.saveAddress : true)) {
        const duplicate = (await customerRepository.addressesFor(owner)).some(
          (a) =>
            a.line1.trim().toLowerCase() === address.line1.trim().toLowerCase() &&
            a.postalCode === address.postalCode
        );
        if (!duplicate) {
          await customerRepository.createAddress(owner, {
            label: address.label,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            landmark: address.landmark,
            isDefault: false,
          });
        }
      }
    }

    // Keep the customer's display name fresh when they give a better one.
    if (customerId && input.name && existing && existing.name !== input.name) {
      await customerRepository.update(customerId, { name: input.name });
    }

    return this.orderByNumber(order.orderNumber);
  },

  async orderByNumber(orderNumber: string) {
    return assertFound(
      await prisma.order.findUnique({
        where: { orderNumber },
        select: publicOrderSelect,
      }),
      "Order"
    );
  },

  /** Orders for the signed-in customer. */
  async myOrders(customerId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        select: orderListSelect,
        orderBy: { placedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { customerId } }),
    ]);
    return { items, total };
  },

  /** Order detail for a signed-in customer, scoped to their own orders. */
  async myOrder(customerId: string, orderNumber: string) {
    const order = await prisma.order.findFirst({
      where: { orderNumber, customerId },
      select: publicOrderSelect,
    });
    return assertFound(order, "Order");
  },

  /**
   * Guest tracking. Requires the order number *and* the mobile number it was
   * placed with, so order numbers alone (which are sequential and guessable)
   * reveal nothing.
   */
  async track(orderNumber: string, rawPhone: string) {
    const phone = normalisePhone(rawPhone);
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumber.trim().toUpperCase() },
      select: publicOrderSelect,
    });

    // One message for "no such order" and "wrong number" alike: distinguishing
    // them would confirm which order numbers exist.
    if (!order || normalisePhone(order.customerPhone) !== phone) {
      throw new AppError(
        "We could not find an order with that number and mobile",
        404,
        "NOT_FOUND"
      );
    }
    return order;
  },

  /** All orders placed against a phone number — used after OTP verification. */
  async ordersForPhone(rawPhone: string) {
    const phone = normalisePhone(rawPhone);
    const customer = await customerRepository.findByPhone(phone);
    if (!customer) return { items: [], total: 0 };
    return this.myOrders(customer.id);
  },
};
