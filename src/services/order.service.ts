import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { toPaise } from "@/lib/money";
import { assertFound } from "@/lib/utils";
import { orderRepository } from "@/repositories/order.repository";
import { couponRepository } from "@/repositories/coupon.repository";
import { customerRepository } from "@/repositories/customer.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { paymentRepository } from "@/repositories/payment.repository";
import { settingsRepository } from "@/repositories/settings.repository";
import {
  assertStatusTransition,
  calculateOrder,
  type CalculatedOrder,
  type CouponRule,
  type PricedLineInput,
} from "./order-calculation";
import type { CreateOrderInput, QuoteOrderInput } from "@/validators/order.validator";
import type { Tx } from "@/types/common";
import type { AuthSession } from "@/lib/auth";

interface ResolvedLine extends PricedLineInput {
  productName: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
}

/**
 * Re-reads every line from the database. Client-supplied prices are ignored
 * entirely — only variantId and quantity are trusted (spec §28).
 */
async function resolveLines(
  db: Tx | typeof prisma,
  items: { variantId: string; quantity: number }[]
): Promise<ResolvedLine[]> {
  if (items.length === 0) return [];

  const variants = await db.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    select: {
      id: true,
      name: true,
      sku: true,
      mrp: true,
      sellingPrice: true,
      discountPrice: true,
      imageUrl: true,
      isActive: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          taxRate: true,
          isActive: true,
        },
      },
    },
  });

  const byId = new Map(variants.map((v) => [v.id, v]));

  return items.map((item) => {
    const variant = byId.get(item.variantId);
    if (!variant) {
      throw new NotFoundError(`Product variant ${item.variantId}`);
    }
    if (!variant.isActive || !variant.product.isActive) {
      throw new BusinessRuleError(
        `${variant.product.name} (${variant.name}) is not available for sale`
      );
    }

    // Effective price: discount price when set, otherwise selling price.
    const unitPrice =
      variant.discountPrice !== null && variant.discountPrice !== undefined
        ? variant.discountPrice
        : variant.sellingPrice;

    return {
      variantId: variant.id,
      productId: variant.product.id,
      quantity: item.quantity,
      mrpPaise: toPaise(variant.mrp),
      unitPricePaise: toPaise(unitPrice),
      taxRate: Number(variant.product.taxRate ?? 0),
      productName: variant.product.name,
      variantName: variant.name,
      sku: variant.sku,
      imageUrl: variant.imageUrl ?? variant.product.images?.[0] ?? null,
    };
  });
}

/** Validates a coupon's active window and usage limit, then returns its rule. */
async function resolveCoupon(
  db: Tx | typeof prisma,
  code: string | undefined | null
): Promise<CouponRule | null> {
  if (!code) return null;

  const coupon = await couponRepository.findByCode(code.trim().toUpperCase(), db);
  if (!coupon) throw new BusinessRuleError(`Coupon ${code} does not exist`);
  if (!coupon.isActive) throw new BusinessRuleError(`Coupon ${coupon.code} is inactive`);

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new BusinessRuleError(`Coupon ${coupon.code} is not active yet`);
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new BusinessRuleError(`Coupon ${coupon.code} has expired`);
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new BusinessRuleError(`Coupon ${coupon.code} has reached its usage limit`);
  }

  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    minOrderValue: Number(coupon.minOrderValue),
    maxDiscount: coupon.maxDiscount === null ? null : Number(coupon.maxDiscount),
  };
}

async function calculationOptions() {
  const settings = await settingsRepository.get();
  return {
    options: {
      pricesIncludeTax: settings.taxSettings.pricesIncludeTax,
      taxEnabled: settings.taxSettings.taxEnabled,
      maxManualDiscountPercent: settings.orderSettings.maxManualDiscountPercent,
    },
    blockExpiredStock: settings.orderSettings.blockExpiredStock,
    autoConfirm: settings.orderSettings.autoConfirmLocalOrders,
    maxDeliveryCharge: settings.deliverySettings.maxDeliveryCharge,
  };
}

export const orderService = {
  /** Live pricing preview — identical maths to `create`. */
  async quote(input: QuoteOrderInput): Promise<CalculatedOrder & { lines: CalculatedOrder["lines"] }> {
    if (input.items.length === 0) {
      return {
        lines: [],
        subtotal: 0,
        itemDiscount: 0,
        couponDiscount: 0,
        manualDiscount: 0,
        discountTotal: 0,
        taxAmount: 0,
        deliveryCharge: input.deliveryCharge,
        grandTotal: input.deliveryCharge,
        appliedCoupon: null,
      };
    }

    const [lines, coupon, config] = await Promise.all([
      resolveLines(prisma, input.items),
      resolveCoupon(prisma, input.couponCode || null),
      calculationOptions(),
    ]);

    return calculateOrder({
      lines,
      coupon,
      manualDiscount: input.manualDiscount,
      deliveryCharge: input.deliveryCharge,
      options: config.options,
    });
  },

  list: orderRepository.list,

  async getById(id: string) {
    return assertFound(await orderRepository.findById(id), "Order");
  },

  /**
   * Creates an order atomically (spec §29). Every step — customer, pricing,
   * coupon, order, payment, stock deduction and ledger — happens inside one
   * database transaction, so a failure anywhere leaves no partial data.
   *
   * `session` is null for storefront orders, which nobody on staff placed.
   * Every column it feeds (`createdByUserId`, the ledger's `userId`, the
   * payment's `recordedByUserId`) is nullable precisely for that case.
   */
  async create(input: CreateOrderInput, session: AuthSession | null) {
    const config = await calculationOptions();

    if (input.deliveryCharge > config.maxDeliveryCharge) {
      throw new ValidationError("Delivery charge exceeds the configured maximum", {
        maxDeliveryCharge: config.maxDeliveryCharge,
      });
    }

    const orderId = await prisma.$transaction(
      async (tx) => {
        // 1. Customer — resolve an existing one or create from the quick form.
        let customerId = input.customerId;
        if (!customerId && input.newCustomer) {
          const existing = await customerRepository.findByPhone(
            input.newCustomer.phone,
            tx
          );
          customerId =
            existing?.id ??
            (
              await customerRepository.create(
                {
                  name: input.newCustomer.name,
                  phone: input.newCustomer.phone,
                  email: input.newCustomer.email ?? null,
                  ...(input.addressLine1
                    ? {
                        addresses: {
                          create: {
                            line1: input.addressLine1,
                            line2: input.addressLine2 || null,
                            city: input.city ?? "",
                            state: input.state ?? "",
                            postalCode: input.postalCode ?? "",
                            isDefault: true,
                          },
                        },
                      }
                    : {}),
                },
                tx
              )
            ).id;
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId! },
          select: { id: true, name: true, phone: true, email: true, isActive: true },
        });
        if (!customer) throw new NotFoundError("Customer");
        if (!customer.isActive) {
          throw new BusinessRuleError("This customer account is inactive");
        }

        // 2-5. Prices, coupon and totals — all recomputed server-side.
        const lines = await resolveLines(tx, input.items);
        const coupon = await resolveCoupon(tx, input.couponCode || null);

        const totals = calculateOrder({
          lines,
          coupon,
          manualDiscount: input.manualDiscount,
          deliveryCharge: input.deliveryCharge,
          options: config.options,
        });

        // 6. Order header.
        const orderNumber = await orderRepository.nextOrderNumber(tx, input.channel);
        const status: OrderStatus =
          input.status ??
          (input.channel === "LOCAL" && config.autoConfirm ? "CONFIRMED" : "PENDING");

        const lineByVariant = new Map(totals.lines.map((l) => [l.variantId, l]));

        const order = await tx.order.create({
          data: {
            orderNumber,
            channel: input.channel,
            orderType: input.orderType,
            status,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            deliveryType: input.deliveryType,
            addressLine1: input.addressLine1 || null,
            addressLine2: input.addressLine2 || null,
            city: input.city || null,
            state: input.state || null,
            postalCode: input.postalCode || null,
            deliveryNotes: input.deliveryNotes || null,
            subtotal: totals.subtotal,
            itemDiscount: totals.itemDiscount,
            couponDiscount: totals.couponDiscount,
            manualDiscount: totals.manualDiscount,
            discountTotal: totals.discountTotal,
            taxAmount: totals.taxAmount,
            deliveryCharge: totals.deliveryCharge,
            grandTotal: totals.grandTotal,
            couponId: coupon?.id ?? null,
            couponCode: coupon?.code ?? null,
            paymentStatus: input.paymentStatus,
            notes: input.notes || null,
            createdByUserId: session?.userId ?? null,
            items: {
              create: lines.map((line) => {
                const calc = lineByVariant.get(line.variantId)!;
                return {
                  productId: line.productId,
                  variantId: line.variantId,
                  productName: line.productName,
                  variantName: line.variantName,
                  sku: line.sku,
                  imageUrl: line.imageUrl,
                  mrp: calc.mrp,
                  unitPrice: calc.unitPrice,
                  quantity: calc.quantity,
                  discountAmount: calc.discountAmount,
                  taxRate: calc.taxRate,
                  taxAmount: calc.taxAmount,
                  lineTotal: calc.lineTotal,
                };
              }),
            },
            statusHistory: {
              create: {
                status,
                userId: session?.userId,
                note: session ? "Order created" : "Placed by customer online",
              },
            },
          },
          select: { id: true },
        });

        // 7. Payment record.
        const paymentNumber = await paymentRepository.nextPaymentNumber(tx);
        await tx.payment.create({
          data: {
            paymentNumber,
            orderId: order.id,
            customerId: customer.id,
            amount: totals.grandTotal,
            method: input.paymentMethod,
            status: input.paymentStatus,
            transactionId: input.transactionId || null,
            paidAt: input.paymentStatus === "PAID" ? new Date() : null,
            recordedByUserId: session?.userId ?? null,
          },
        });

        // 8. Stock deduction (FEFO) + ledger entries.
        for (const line of lines) {
          await inventoryRepository.deductStockFEFO(tx, {
            variantId: line.variantId,
            quantity: line.quantity,
            orderId: order.id,
            userId: session?.userId,
            blockExpired: config.blockExpiredStock,
            note: `Order ${orderNumber}`,
          });
        }

        // 9. Coupon usage.
        if (coupon) await couponRepository.incrementUsage(coupon.id, tx);

        return order.id;
      },
      { timeout: 30_000, maxWait: 10_000 }
    );

    return this.getById(orderId);
  },

  /**
   * Applies a status change after validating the transition, restoring stock
   * when an order is cancelled or returned.
   */
  async updateStatus(
    id: string,
    status: OrderStatus,
    session: AuthSession,
    note?: string
  ) {
    const order = assertFound(
      await prisma.order.findUnique({
        where: { id },
        select: { id: true, status: true, orderNumber: true, couponId: true },
      }),
      "Order"
    );

    assertStatusTransition(order.status, status);

    const restoresStock = status === "CANCELLED" || status === "RETURNED";

    await prisma.$transaction(
      async (tx) => {
        if (restoresStock) {
          const items = await orderRepository.itemsForOrder(id, tx);
          for (const item of items) {
            await inventoryRepository.restoreStock(tx, {
              variantId: item.variantId,
              quantity: item.quantity,
              orderId: id,
              userId: session.userId,
              type: status === "RETURNED" ? "RETURN" : "STOCK_ADDED",
              note: `${status === "RETURNED" ? "Return" : "Cancellation"} of order ${order.orderNumber}`,
            });
          }
          // Free the coupon use back up.
          if (order.couponId) {
            await couponRepository.decrementUsage(order.couponId, tx);
          }
        }

        const extra: Prisma.OrderUpdateInput = {
          ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
          ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        };

        await tx.order.update({ where: { id }, data: { status, ...extra } });
        await orderRepository.addStatusHistory(id, status, session.userId, note, tx);
      },
      { timeout: 30_000 }
    );

    return this.getById(id);
  },

  async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    session: AuthSession,
    opts: { transactionId?: string } = {}
  ) {
    const order = assertFound(
      await prisma.order.findUnique({
        where: { id },
        select: { id: true, grandTotal: true, paymentStatus: true },
      }),
      "Order"
    );

    if (order.paymentStatus === paymentStatus) {
      throw new BusinessRuleError(
        `Payment is already marked ${paymentStatus.toLowerCase()}`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { paymentStatus } });

      const latest = await tx.payment.findFirst({
        where: { orderId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (latest) {
        await tx.payment.update({
          where: { id: latest.id },
          data: {
            status: paymentStatus,
            paidAt: paymentStatus === "PAID" ? new Date() : null,
            ...(opts.transactionId ? { transactionId: opts.transactionId } : {}),
            recordedByUserId: session.userId,
          },
        });
      }
    });

    return this.getById(id);
  },
};
