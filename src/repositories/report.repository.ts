import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { OrderChannel } from "@/generated/prisma/enums";
import { addDays, endOfDay, startOfDay } from "@/lib/utils";

/** Orders in these states never count toward revenue. */
const REVENUE_EXCLUDED = ["CANCELLED", "RETURNED"] as const;

export interface RangeInput {
  from: Date;
  to: Date;
  channel?: OrderChannel;
}

function channelSql(channel?: OrderChannel) {
  return channel ? Prisma.sql`AND o."channel" = ${channel}::"OrderChannel"` : Prisma.empty;
}

export const reportRepository = {
  // ---- Dashboard ---------------------------------------------------------

  async summaryCards() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = startOfDay(addDays(now, -1));
    const yesterdayEnd = endOfDay(addDays(now, -1));

    const revenueWhere = { status: { notIn: [...REVENUE_EXCLUDED] } };

    const [
      todaySales,
      yesterdaySales,
      totalSales,
      totalOrders,
      todayOrders,
      yesterdayOrders,
      localOrders,
      onlineOrders,
      pendingOrders,
      completedOrders,
      totalCustomers,
      newCustomersToday,
      totalProducts,
      activeProducts,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { ...revenueWhere, placedAt: { gte: todayStart, lte: todayEnd } },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: { ...revenueWhere, placedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({ where: revenueWhere, _sum: { grandTotal: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { placedAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.order.count({
        where: { placedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      }),
      prisma.order.count({ where: { channel: "LOCAL" } }),
      prisma.order.count({ where: { channel: "ONLINE" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    const pct = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    const todayRevenue = Number(todaySales._sum.grandTotal ?? 0);
    const yesterdayRevenue = Number(yesterdaySales._sum.grandTotal ?? 0);

    return {
      todaySales: todayRevenue,
      todaySalesChange: pct(todayRevenue, yesterdayRevenue),
      totalSales: Number(totalSales._sum.grandTotal ?? 0),
      totalOrders,
      todayOrders,
      todayOrdersChange: pct(todayOrders, yesterdayOrders),
      localOrders,
      onlineOrders,
      pendingOrders,
      completedOrders,
      totalCustomers,
      newCustomersToday,
      totalProducts,
      activeProducts,
    };
  },

  /** Revenue + order-count series for the dashboard sales chart. */
  async salesSeries(range: "daily" | "weekly" | "monthly") {
    const config = {
      daily: { unit: "day", since: addDays(new Date(), -13) },
      weekly: { unit: "week", since: addDays(new Date(), -7 * 11) },
      monthly: { unit: "month", since: addDays(new Date(), -365) },
    }[range];

    const rows = await prisma.$queryRaw<
      { bucket: Date; revenue: string | null; orders: bigint }[]
    >`
      SELECT date_trunc(${config.unit}, o."placedAt") AS bucket,
             SUM(o."grandTotal")                      AS revenue,
             COUNT(*)                                 AS orders
      FROM orders o
      WHERE o."placedAt" >= ${startOfDay(config.since)}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      revenue: Number(r.revenue ?? 0),
      orders: Number(r.orders),
    }));
  },

  async ordersOverview() {
    const grouped = await prisma.order.groupBy({
      by: ["channel", "status"],
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      channel: g.channel,
      status: g.status,
      count: g._count._all,
    }));
  },

  async statusBreakdown() {
    const grouped = await prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  },

  /** Best sellers by units and revenue over a window. */
  async topProducts(params: { from?: Date; to?: Date; limit?: number } = {}) {
    const from = params.from ?? addDays(new Date(), -30);
    const to = params.to ?? new Date();
    const limit = params.limit ?? 8;

    const rows = await prisma.$queryRaw<
      {
        productId: string;
        name: string;
        sku: string;
        images: string[];
        units: bigint;
        revenue: string | null;
        avgPrice: string | null;
      }[]
    >`
      SELECT p."id"   AS "productId",
             p."name" AS name,
             p."sku"  AS sku,
             p."images" AS images,
             SUM(oi."quantity")   AS units,
             SUM(oi."lineTotal")  AS revenue,
             AVG(oi."unitPrice")  AS "avgPrice"
      FROM order_items oi
      JOIN orders   o ON o."id" = oi."orderId"
      JOIN products p ON p."id" = oi."productId"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY p."id", p."name", p."sku", p."images"
      ORDER BY units DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      image: r.images?.[0] ?? null,
      units: Number(r.units),
      revenue: Number(r.revenue ?? 0),
      avgPrice: Number(r.avgPrice ?? 0),
    }));
  },

  /** Slow movers — active products with the fewest units sold in the window. */
  async lowPerformingProducts(params: { from?: Date; to?: Date; limit?: number } = {}) {
    const from = params.from ?? addDays(new Date(), -30);
    const to = params.to ?? new Date();
    const limit = params.limit ?? 8;

    const rows = await prisma.$queryRaw<
      { productId: string; name: string; sku: string; units: bigint; revenue: string | null }[]
    >`
      SELECT p."id" AS "productId", p."name" AS name, p."sku" AS sku,
             COALESCE(SUM(oi."quantity"), 0)  AS units,
             COALESCE(SUM(oi."lineTotal"), 0) AS revenue
      FROM products p
      LEFT JOIN order_items oi ON oi."productId" = p."id"
      LEFT JOIN orders o
             ON o."id" = oi."orderId"
            AND o."placedAt" BETWEEN ${from} AND ${to}
            AND o."status" NOT IN ('CANCELLED', 'RETURNED')
      WHERE p."isActive" = true
      GROUP BY p."id", p."name", p."sku"
      ORDER BY units ASC, p."name" ASC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      units: Number(r.units),
      revenue: Number(r.revenue ?? 0),
    }));
  },

  lowStock(limit = 10) {
    return prisma.inventory.findMany({
      where: { currentStock: { lte: prisma.inventory.fields.minStock } },
      select: {
        id: true,
        currentStock: true,
        minStock: true,
        variant: { select: { id: true, name: true, sku: true } },
        product: { select: { id: true, name: true, unit: true, images: true } },
      },
      orderBy: { currentStock: "asc" },
      take: limit,
    });
  },

  expiringBatches(days = 30, limit = 10) {
    const today = startOfDay(new Date());
    return prisma.inventoryBatch.findMany({
      where: {
        isActive: true,
        remainingQuantity: { gt: 0 },
        expiryDate: { not: null, lte: addDays(today, days) },
      },
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        remainingQuantity: true,
        product: { select: { id: true, name: true, unit: true } },
        variant: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: limit,
    });
  },

  // ---- Reports -----------------------------------------------------------

  async salesSummary({ from, to, channel }: RangeInput) {
    const rows = await prisma.$queryRaw<
      {
        gross: string | null;
        discounts: string | null;
        tax: string | null;
        delivery: string | null;
        net: string | null;
        orders: bigint;
      }[]
    >`
      SELECT SUM(o."subtotal")       AS gross,
             SUM(o."discountTotal")  AS discounts,
             SUM(o."taxAmount")      AS tax,
             SUM(o."deliveryCharge") AS delivery,
             SUM(o."grandTotal")     AS net,
             COUNT(*)                AS orders
      FROM orders o
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
        ${channelSql(channel)}
    `;

    const r = rows[0];
    const orders = Number(r?.orders ?? 0);
    const net = Number(r?.net ?? 0);

    return {
      grossSales: Number(r?.gross ?? 0),
      discounts: Number(r?.discounts ?? 0),
      tax: Number(r?.tax ?? 0),
      deliveryRevenue: Number(r?.delivery ?? 0),
      netSales: net,
      orders,
      averageOrderValue: orders === 0 ? 0 : net / orders,
    };
  },

  async salesByPeriod({ from, to, channel }: RangeInput, groupBy: "day" | "week" | "month") {
    const rows = await prisma.$queryRaw<
      {
        bucket: Date;
        gross: string | null;
        discounts: string | null;
        tax: string | null;
        net: string | null;
        orders: bigint;
      }[]
    >`
      SELECT date_trunc(${groupBy}, o."placedAt") AS bucket,
             SUM(o."subtotal")      AS gross,
             SUM(o."discountTotal") AS discounts,
             SUM(o."taxAmount")     AS tax,
             SUM(o."grandTotal")    AS net,
             COUNT(*)               AS orders
      FROM orders o
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
        ${channelSql(channel)}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      grossSales: Number(r.gross ?? 0),
      discounts: Number(r.discounts ?? 0),
      tax: Number(r.tax ?? 0),
      netSales: Number(r.net ?? 0),
      orders: Number(r.orders),
    }));
  },

  async salesByCategory({ from, to, channel }: RangeInput) {
    const rows = await prisma.$queryRaw<
      { categoryId: number; name: string; units: bigint; revenue: string | null }[]
    >`
      SELECT c."id" AS "categoryId", c."name" AS name,
             SUM(oi."quantity")  AS units,
             SUM(oi."lineTotal") AS revenue
      FROM order_items oi
      JOIN orders     o ON o."id" = oi."orderId"
      JOIN products   p ON p."id" = oi."productId"
      JOIN categories c ON c."id" = p."categoryId"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
        ${channelSql(channel)}
      GROUP BY c."id", c."name"
      ORDER BY revenue DESC NULLS LAST
    `;

    return rows.map((r) => ({
      categoryId: r.categoryId,
      name: r.name,
      units: Number(r.units),
      revenue: Number(r.revenue ?? 0),
    }));
  },

  async salesByOrderType({ from, to, channel }: RangeInput) {
    const rows = await prisma.$queryRaw<
      { orderType: string; orders: bigint; revenue: string | null }[]
    >`
      SELECT o."orderType"::text AS "orderType",
             COUNT(*)            AS orders,
             SUM(o."grandTotal") AS revenue
      FROM orders o
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
        ${channelSql(channel)}
      GROUP BY o."orderType"
      ORDER BY revenue DESC NULLS LAST
    `;

    return rows.map((r) => ({
      orderType: r.orderType,
      orders: Number(r.orders),
      revenue: Number(r.revenue ?? 0),
    }));
  },

  async topCustomers({ from, to }: RangeInput, limit = 20) {
    const rows = await prisma.$queryRaw<
      {
        customerId: string;
        name: string;
        phone: string;
        orders: bigint;
        revenue: string | null;
      }[]
    >`
      SELECT c."id" AS "customerId", c."name" AS name, c."phone" AS phone,
             COUNT(o."id")       AS orders,
             SUM(o."grandTotal") AS revenue
      FROM customers c
      JOIN orders o ON o."customerId" = c."id"
      WHERE o."placedAt" BETWEEN ${from} AND ${to}
        AND o."status" NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY c."id", c."name", c."phone"
      ORDER BY revenue DESC NULLS LAST
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      customerId: r.customerId,
      name: r.name,
      phone: r.phone,
      orders: Number(r.orders),
      revenue: Number(r.revenue ?? 0),
    }));
  },

  async paymentsBreakdown({ from, to }: RangeInput) {
    const grouped = await prisma.payment.groupBy({
      by: ["method", "status"],
      where: { createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      method: g.method,
      status: g.status,
      count: g._count._all,
      amount: Number(g._sum.amount ?? 0),
    }));
  },

  async newCustomers({ from, to }: RangeInput) {
    const rows = await prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
      SELECT date_trunc('day', c."createdAt") AS bucket, COUNT(*) AS count
      FROM customers c
      WHERE c."createdAt" BETWEEN ${from} AND ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    return rows.map((r) => ({ bucket: r.bucket.toISOString(), count: Number(r.count) }));
  },

  async inventoryValuation() {
    const rows = await prisma.$queryRaw<
      { units: bigint | null; retail: string | null; skus: bigint }[]
    >`
      SELECT SUM(i."currentStock")                        AS units,
             SUM(i."currentStock" * v."sellingPrice")     AS retail,
             COUNT(*)                                     AS skus
      FROM inventory i
      JOIN product_variants v ON v."id" = i."variantId"
    `;
    const r = rows[0];
    return {
      totalUnits: Number(r?.units ?? 0),
      retailValue: Number(r?.retail ?? 0),
      skuCount: Number(r?.skus ?? 0),
    };
  },
};
