import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { paginate, paginationMeta } from "@/lib/utils";
import type { Tx } from "@/types/common";

export const couponRepository = {
  findById(id: string) {
    return prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
  },

  findByCode(code: string, tx: Tx | typeof prisma = prisma) {
    return tx.coupon.findUnique({ where: { code } });
  },

  codeExists(code: string, exceptId?: string) {
    return prisma.coupon
      .count({ where: { code, ...(exceptId ? { id: { not: exceptId } } : {}) } })
      .then((n) => n > 0);
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    status?: "active" | "expired" | "scheduled" | "exhausted";
  }) {
    const { skip, take, page, limit } = paginate(params);
    const now = new Date();

    const statusWhere: Prisma.CouponWhereInput =
      params.status === "expired"
        ? { expiresAt: { lt: now } }
        : params.status === "scheduled"
          ? { startsAt: { gt: now } }
          : params.status === "exhausted"
            ? {
                usageLimit: { not: null },
                usedCount: { gte: prisma.coupon.fields.usageLimit },
              }
            : params.status === "active"
              ? {
                  isActive: true,
                  AND: [
                    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                    { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
                  ],
                }
              : {};

    const where: Prisma.CouponWhereInput = {
      ...statusWhere,
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { code: { contains: params.search, mode: "insensitive" } },
              { description: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.coupon.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  create(data: Prisma.CouponCreateInput) {
    return prisma.coupon.create({ data });
  },

  update(id: string, data: Prisma.CouponUpdateInput) {
    return prisma.coupon.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.coupon.delete({ where: { id } });
  },

  incrementUsage(id: string, tx: Tx | typeof prisma = prisma) {
    return tx.coupon.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
      select: { id: true, usedCount: true },
    });
  },

  decrementUsage(id: string, tx: Tx | typeof prisma = prisma) {
    return tx.coupon.update({
      where: { id },
      data: { usedCount: { decrement: 1 } },
      select: { id: true },
    });
  },
};
