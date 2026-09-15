import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { dateKey, paginate, paginationMeta } from "@/lib/utils";
import type { Tx } from "@/types/common";

const paymentSelect = {
  id: true,
  paymentNumber: true,
  amount: true,
  method: true,
  status: true,
  transactionId: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  order: { select: { id: true, orderNumber: true, grandTotal: true, channel: true } },
  customer: { select: { id: true, name: true, phone: true } },
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.PaymentSelect;

export const paymentRepository = {
  async nextPaymentNumber(tx: Tx): Promise<string> {
    const key = dateKey();
    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO order_sequences ("prefix", "dateKey", "lastNumber")
      VALUES ('PAY', ${key}, 1)
      ON CONFLICT ("prefix", "dateKey")
      DO UPDATE SET "lastNumber" = order_sequences."lastNumber" + 1
      RETURNING "lastNumber"
    `;
    const next = rows[0]?.lastNumber ?? 1;
    return `PAY-${key}-${String(next).padStart(4, "0")}`;
  },

  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, select: paymentSelect });
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    status?: PaymentStatus;
    method?: PaymentMethod;
    orderId?: string;
    customerId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.PaymentWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.method ? { method: params.method } : {}),
      ...(params.orderId ? { orderId: params.orderId } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { paymentNumber: { contains: params.search, mode: "insensitive" } },
              { transactionId: { contains: params.search, mode: "insensitive" } },
              { order: { orderNumber: { contains: params.search, mode: "insensitive" } } },
              { customer: { name: { contains: params.search, mode: "insensitive" } } },
              { customer: { phone: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total, totals] = await Promise.all([
      prisma.payment.findMany({
        where,
        select: paymentSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where: { ...where, status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

    return {
      items,
      meta: paginationMeta(total, page, limit),
      collected: Number(totals._sum.amount ?? 0),
    };
  },

  create(data: Prisma.PaymentCreateInput, tx: Tx | typeof prisma = prisma) {
    return tx.payment.create({ data, select: paymentSelect });
  },

  update(id: string, data: Prisma.PaymentUpdateInput) {
    return prisma.payment.update({ where: { id }, data, select: paymentSelect });
  },

  sumPaidForOrder(orderId: string, tx: Tx | typeof prisma = prisma) {
    return tx.payment
      .aggregate({ where: { orderId, status: "PAID" }, _sum: { amount: true } })
      .then((r) => Number(r._sum.amount ?? 0));
  },
};
