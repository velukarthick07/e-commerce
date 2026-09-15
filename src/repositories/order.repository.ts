import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  OrderChannel,
  OrderStatus,
  OrderType,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { dateKey, paginate, paginationMeta } from "@/lib/utils";
import type { Tx } from "@/types/common";

export const orderListSelect = {
  id: true,
  orderNumber: true,
  channel: true,
  orderType: true,
  status: true,
  paymentStatus: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  deliveryType: true,
  subtotal: true,
  discountTotal: true,
  taxAmount: true,
  deliveryCharge: true,
  grandTotal: true,
  placedAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

export const orderRepository = {
  /**
   * Human-readable, gap-free per-day order numbers (ORD-YYYYMMDD-0001 /
   * LOC-…). The upsert + atomic increment runs inside the caller's
   * transaction, so two concurrent orders can never take the same number.
   */
  async nextOrderNumber(tx: Tx, channel: OrderChannel): Promise<string> {
    const prefix = channel === "LOCAL" ? "LOC" : "ORD";
    const key = dateKey();

    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO order_sequences ("prefix", "dateKey", "lastNumber")
      VALUES (${prefix}, ${key}, 1)
      ON CONFLICT ("prefix", "dateKey")
      DO UPDATE SET "lastNumber" = order_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;

    const next = rows[0]?.lastNumber ?? 1;
    return `${prefix}-${key}-${String(next).padStart(4, "0")}`;
  },

  findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            addresses: { where: { isDefault: true }, take: 1 },
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, images: true, unit: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          include: { recordedBy: { select: { id: true, name: true } } },
        },
        statusHistory: { orderBy: { createdAt: "asc" } },
        coupon: { select: { id: true, code: true, discountType: true, discountValue: true } },
        createdBy: { select: { id: true, name: true } },
        transactions: {
          where: { type: "ORDER_DEDUCTION" },
          select: {
            id: true,
            quantity: true,
            variantId: true,
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
      },
    });
  },

  findByNumber(orderNumber: string) {
    return prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: OrderStatus;
    channel?: OrderChannel;
    orderType?: OrderType;
    paymentStatus?: PaymentStatus;
    customerId?: string;
    from?: Date;
    to?: Date;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  }) {
    const { skip, take, page, limit } = paginate(params);

    const where: Prisma.OrderWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.channel ? { channel: params.channel } : {}),
      ...(params.orderType ? { orderType: params.orderType } : {}),
      ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.from || params.to
        ? {
            placedAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { orderNumber: { contains: params.search, mode: "insensitive" } },
              { customerName: { contains: params.search, mode: "insensitive" } },
              { customerPhone: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortable: Record<string, Prisma.OrderOrderByWithRelationInput> = {
      placedAt: { placedAt: params.sortOrder },
      grandTotal: { grandTotal: params.sortOrder },
      orderNumber: { orderNumber: params.sortOrder },
    };
    const orderBy = sortable[params.sortBy ?? "placedAt"] ?? { placedAt: params.sortOrder };

    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, select: orderListSelect, orderBy, skip, take }),
      prisma.order.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  updateStatus(
    id: string,
    status: OrderStatus,
    extra: Prisma.OrderUpdateInput = {}
  ) {
    return prisma.order.update({
      where: { id },
      data: { status, ...extra },
      select: { id: true, status: true, orderNumber: true },
    });
  },

  addStatusHistory(
    orderId: string,
    status: OrderStatus,
    userId?: number,
    note?: string,
    tx: Tx | typeof prisma = prisma
  ) {
    return tx.orderStatusHistory.create({
      data: { orderId, status, userId, note: note || undefined },
    });
  },

  updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
    return prisma.order.update({
      where: { id },
      data: { paymentStatus },
      select: { id: true, paymentStatus: true },
    });
  },

  itemsForOrder(orderId: string, tx: Tx | typeof prisma = prisma) {
    return tx.orderItem.findMany({
      where: { orderId },
      select: { id: true, variantId: true, productId: true, quantity: true },
    });
  },
};
