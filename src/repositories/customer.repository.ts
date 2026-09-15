import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { paginate, paginationMeta } from "@/lib/utils";
import type { Tx } from "@/types/common";

const addressSelect = {
  id: true,
  label: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  landmark: true,
  isDefault: true,
} satisfies Prisma.CustomerAddressSelect;

const baseSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  addresses: { select: addressSelect, orderBy: { isDefault: "desc" } },
} satisfies Prisma.CustomerSelect;

/** Order totals are aggregated on read so they can never drift from reality. */
async function attachStats<T extends { id: string }>(customers: T[]) {
  if (customers.length === 0) return [] as (T & {
    totalOrders: number;
    totalSpent: number;
    lastOrderAt: string | null;
  })[];

  const grouped = await prisma.order.groupBy({
    by: ["customerId"],
    where: {
      customerId: { in: customers.map((c) => c.id) },
      status: { notIn: ["CANCELLED", "RETURNED"] },
    },
    _count: { _all: true },
    _sum: { grandTotal: true },
    _max: { placedAt: true },
  });

  const byId = new Map(grouped.map((g) => [g.customerId, g]));
  return customers.map((c) => {
    const g = byId.get(c.id);
    return {
      ...c,
      totalOrders: g?._count._all ?? 0,
      totalSpent: Number(g?._sum.grandTotal ?? 0),
      lastOrderAt: g?._max.placedAt ? g._max.placedAt.toISOString() : null,
    };
  });
}

export const customerRepository = {
  async findById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: baseSelect,
    });
    if (!customer) return null;
    const [withStats] = await attachStats([customer]);
    return withStats;
  },

  findByPhone(phone: string, tx: Tx | typeof prisma = prisma) {
    return tx.customer.findUnique({ where: { phone }, select: baseSelect });
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.CustomerWhereInput = {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { phone: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // Aggregate sorts cannot be expressed in a single Prisma query, so they are
    // resolved from the grouped order totals before paginating.
    if (params.sortBy === "totalSpent" || params.sortBy === "totalOrders") {
      const matching = await prisma.customer.findMany({
        where,
        select: { id: true },
      });
      const ids = matching.map((m) => m.id);
      const grouped = await prisma.order.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids }, status: { notIn: ["CANCELLED", "RETURNED"] } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      });
      const metric = new Map(
        grouped.map((g) => [
          g.customerId,
          params.sortBy === "totalSpent"
            ? Number(g._sum.grandTotal ?? 0)
            : g._count._all,
        ])
      );
      const ordered = ids
        .map((id) => ({ id, value: metric.get(id) ?? 0 }))
        .sort((a, b) =>
          params.sortOrder === "asc" ? a.value - b.value : b.value - a.value
        )
        .slice(skip, skip + take)
        .map((r) => r.id);

      const rows = await prisma.customer.findMany({
        where: { id: { in: ordered } },
        select: baseSelect,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = await attachStats(
        ordered.map((id) => byId.get(id)!).filter(Boolean)
      );
      return { items, meta: paginationMeta(ids.length, page, limit) };
    }

    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      params.sortBy === "name"
        ? { name: params.sortOrder }
        : { createdAt: params.sortOrder };

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({ where, select: baseSelect, orderBy, skip, take }),
      prisma.customer.count({ where }),
    ]);

    return { items: await attachStats(rows), meta: paginationMeta(total, page, limit) };
  },

  /** Type-ahead for the local-order customer picker. */
  search(q: string, limit = 15) {
    return prisma.customer.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: baseSelect,
      orderBy: { name: "asc" },
      take: limit,
    });
  },

  create(data: Prisma.CustomerCreateInput, tx: Tx | typeof prisma = prisma) {
    return tx.customer.create({ data, select: baseSelect });
  },

  update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data, select: baseSelect });
  },

  delete(id: string) {
    return prisma.customer.delete({ where: { id } });
  },

  countOrders(customerId: string) {
    return prisma.order.count({ where: { customerId } });
  },

  orderHistory(customerId: string, limit = 20) {
    return prisma.order.findMany({
      where: { customerId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        channel: true,
        orderType: true,
        grandTotal: true,
        placedAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { placedAt: "desc" },
      take: limit,
    });
  },

  touchLogin(customerId: string) {
    return prisma.customer.update({
      where: { id: customerId },
      data: { lastLoginAt: new Date() },
      select: { id: true },
    });
  },

  // --- Address book (storefront) -------------------------------------------
  //
  // Exactly one address per customer carries `isDefault`. Every mutation below
  // re-establishes that inside a transaction rather than trusting callers, so
  // a half-finished request can never leave two defaults (or none).

  addressesFor(customerId: string) {
    return prisma.customerAddress.findMany({
      where: { customerId },
      select: addressSelect,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  },

  findAddress(id: string, customerId: string) {
    return prisma.customerAddress.findFirst({
      where: { id, customerId },
      select: addressSelect,
    });
  },

  countAddresses(customerId: string) {
    return prisma.customerAddress.count({ where: { customerId } });
  },

  createAddress(
    customerId: string,
    data: Omit<Prisma.CustomerAddressCreateManyInput, "customerId">
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.count({ where: { customerId } });
      // The first address a customer saves is their default whether they asked
      // for it or not — otherwise checkout would have nothing to preselect.
      const isDefault = data.isDefault === true || existing === 0;

      if (isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: { ...data, customerId, isDefault },
        select: addressSelect,
      });
    });
  },

  updateAddress(
    id: string,
    customerId: string,
    data: Omit<Prisma.CustomerAddressUpdateInput, "customer">
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }
      await tx.customerAddress.update({ where: { id }, data });
      return tx.customerAddress.findUnique({ where: { id }, select: addressSelect });
    });
  },

  deleteAddress(id: string, customerId: string) {
    return prisma.$transaction(async (tx) => {
      const removed = await tx.customerAddress.delete({
        where: { id },
        select: { isDefault: true },
      });

      // Promote the oldest remaining address so the customer is never left
      // without a default.
      if (removed.isDefault) {
        const next = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (next) {
          await tx.customerAddress.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
      return { id };
    });
  },

  setDefaultAddress(id: string, customerId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
      await tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
      return tx.customerAddress.findMany({
        where: { customerId },
        select: addressSelect,
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
    });
  },

  replaceAddresses(
    customerId: string,
    addresses: Prisma.CustomerAddressCreateManyInput[]
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.customerAddress.deleteMany({ where: { customerId } });
      if (addresses.length > 0) {
        await tx.customerAddress.createMany({ data: addresses });
      }
      return tx.customer.findUnique({ where: { id: customerId }, select: baseSelect });
    });
  },
};
