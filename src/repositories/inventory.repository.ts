import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { InventoryTransactionType } from "@/generated/prisma/enums";
import { addDays, paginate, paginationMeta, startOfDay } from "@/lib/utils";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import type { ExpiryBucket, StockStatus, Tx } from "@/types/common";

export interface BatchAllocation {
  batchId: string | null;
  batchNumber: string | null;
  quantity: number;
  expiryDate: Date | null;
}

const inventorySelect = {
  id: true,
  currentStock: true,
  reservedStock: true,
  minStock: true,
  maxStock: true,
  lastRestockedAt: true,
  variant: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      mrp: true,
      sellingPrice: true,
      isActive: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      images: true,
      isActive: true,
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InventorySelect;

function stockWhere(status: StockStatus): Prisma.InventoryWhereInput {
  if (status === "out_of_stock") return { currentStock: { lte: 0 } };
  if (status === "low_stock")
    return { currentStock: { gt: 0, lte: prisma.inventory.fields.minStock } };
  return { currentStock: { gt: prisma.inventory.fields.minStock } };
}

/** Date windows behind the Expiry Management buckets. */
export function expiryWhere(bucket: ExpiryBucket): Prisma.InventoryBatchWhereInput {
  const today = startOfDay(new Date());
  switch (bucket) {
    case "expired":
      return { expiryDate: { lt: today } };
    case "7_days":
      return { expiryDate: { gte: today, lte: addDays(today, 7) } };
    case "30_days":
      return { expiryDate: { gt: addDays(today, 7), lte: addDays(today, 30) } };
    case "60_days":
      return { expiryDate: { gt: addDays(today, 30), lte: addDays(today, 60) } };
    case "normal":
      return { OR: [{ expiryDate: null }, { expiryDate: { gt: addDays(today, 60) } }] };
  }
}

export const inventoryRepository = {
  async list(params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: number;
    stockStatus?: StockStatus;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.InventoryWhereInput = {
      ...(params.stockStatus ? stockWhere(params.stockStatus) : {}),
      ...(params.categoryId
        ? {
            product: {
              OR: [
                { categoryId: params.categoryId },
                { subcategoryId: params.categoryId },
                { category: { parentId: params.categoryId } },
              ],
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { product: { name: { contains: params.search, mode: "insensitive" } } },
              { product: { sku: { contains: params.search, mode: "insensitive" } } },
              { variant: { sku: { contains: params.search, mode: "insensitive" } } },
              { variant: { barcode: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.InventoryOrderByWithRelationInput =
      params.sortBy === "productName"
        ? { product: { name: params.sortOrder } }
        : { currentStock: params.sortOrder };

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({ where, select: inventorySelect, orderBy, skip, take }),
      prisma.inventory.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  summary() {
    return prisma.$transaction([
      prisma.inventory.count(),
      prisma.inventory.count({ where: stockWhere("out_of_stock") }),
      prisma.inventory.count({ where: stockWhere("low_stock") }),
      prisma.inventory.count({ where: stockWhere("in_stock") }),
    ]);
  },

  findByVariant(variantId: string) {
    return prisma.inventory.findUnique({
      where: { variantId },
      select: inventorySelect,
    });
  },

  setMinMax(variantId: string, minStock: number, maxStock: number) {
    return prisma.inventory.update({
      where: { variantId },
      data: { minStock, maxStock },
      select: inventorySelect,
    });
  },

  // ---- Batches -----------------------------------------------------------

  async listBatches(params: {
    page: number;
    limit: number;
    search?: string;
    productId?: string;
    variantId?: string;
    categoryId?: number;
    expiryBucket?: ExpiryBucket;
    from?: Date;
    to?: Date;
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.InventoryBatchWhereInput = {
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.variantId ? { variantId: params.variantId } : {}),
      ...(params.expiryBucket ? expiryWhere(params.expiryBucket) : {}),
      ...(params.categoryId
        ? {
            product: {
              OR: [
                { categoryId: params.categoryId },
                { subcategoryId: params.categoryId },
                { category: { parentId: params.categoryId } },
              ],
            },
          }
        : {}),
      ...(params.from || params.to
        ? {
            expiryDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { batchNumber: { contains: params.search, mode: "insensitive" } },
              { product: { name: { contains: params.search, mode: "insensitive" } } },
              { variant: { sku: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              category: { select: { id: true, name: true } },
            },
          },
          variant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip,
        take,
      }),
      prisma.inventoryBatch.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  async expirySummary() {
    const buckets: ExpiryBucket[] = ["expired", "7_days", "30_days", "60_days", "normal"];
    const counts = await Promise.all(
      buckets.map((b) =>
        prisma.inventoryBatch.aggregate({
          where: { isActive: true, remainingQuantity: { gt: 0 }, ...expiryWhere(b) },
          _count: { _all: true },
          _sum: { remainingQuantity: true },
        })
      )
    );
    return buckets.map((bucket, i) => ({
      bucket,
      batches: counts[i]._count._all,
      units: counts[i]._sum.remainingQuantity ?? 0,
    }));
  },

  findBatchById(id: string) {
    return prisma.inventoryBatch.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
      },
    });
  },

  deleteBatch(id: string) {
    return prisma.inventoryBatch.delete({ where: { id } });
  },

  // ---- Transactions ------------------------------------------------------

  async listTransactions(params: {
    page: number;
    limit: number;
    productId?: string;
    variantId?: string;
    type?: InventoryTransactionType;
    orderId?: string;
    from?: Date;
    to?: Date;
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.InventoryTransactionWhereInput = {
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.variantId ? { variantId: params.variantId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.orderId ? { orderId: params.orderId } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, sku: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
          user: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  // ---- Core stock movement (transaction-scoped) --------------------------

  /**
   * Locks the inventory row for the duration of the surrounding transaction.
   * Without this, two concurrent orders could both read the same stock level
   * and oversell.
   */
  async lockInventoryRow(tx: Tx, variantId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM inventory WHERE "variantId" = ${variantId} FOR UPDATE`;
  },

  /**
   * First-Expiry-First-Out allocation. Consumes batch quantities in ascending
   * expiry order; any shortfall in batch coverage is recorded against a null
   * batch so that products which are not batch-tracked still deduct correctly.
   */
  async deductStockFEFO(
    tx: Tx,
    params: {
      variantId: string;
      quantity: number;
      orderId?: string;
      userId?: number;
      blockExpired: boolean;
      note?: string;
      /** Ledger type to record; defaults to an order deduction. */
      type?: InventoryTransactionType;
      referenceType?: string;
    }
  ): Promise<{ allocations: BatchAllocation[]; previousStock: number; newStock: number }> {
    const { variantId, quantity } = params;

    await this.lockInventoryRow(tx, variantId);

    const inventory = await tx.inventory.findUnique({
      where: { variantId },
      select: { id: true, productId: true, currentStock: true, reservedStock: true },
    });
    if (!inventory) throw new NotFoundError("Inventory record");

    const available = inventory.currentStock - inventory.reservedStock;
    if (available < quantity) {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: { name: true, product: { select: { name: true } } },
      });
      throw new BusinessRuleError(
        `Not enough stock for ${variant?.product.name ?? "product"} (${variant?.name ?? ""}). Available: ${available}, requested: ${quantity}`,
        { variantId, available, requested: quantity }
      );
    }

    const today = startOfDay(new Date());
    const batches = await tx.inventoryBatch.findMany({
      where: {
        variantId,
        isActive: true,
        remainingQuantity: { gt: 0 },
        ...(params.blockExpired
          ? { OR: [{ expiryDate: null }, { expiryDate: { gte: today } }] }
          : {}),
      },
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedDate: "asc" }],
      select: { id: true, batchNumber: true, remainingQuantity: true, expiryDate: true },
    });

    const allocations: BatchAllocation[] = [];
    let outstanding = quantity;

    for (const batch of batches) {
      if (outstanding <= 0) break;
      const take = Math.min(batch.remainingQuantity, outstanding);
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: { remainingQuantity: { decrement: take } },
      });
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: take,
        expiryDate: batch.expiryDate,
      });
      outstanding -= take;
    }

    if (outstanding > 0) {
      // Not batch-tracked (or partially tracked) — deduct the remainder plainly.
      allocations.push({
        batchId: null,
        batchNumber: null,
        quantity: outstanding,
        expiryDate: null,
      });
    }

    const previousStock = inventory.currentStock;
    const newStock = previousStock - quantity;

    await tx.inventory.update({
      where: { variantId },
      data: { currentStock: newStock },
    });

    // One ledger row per batch consumed, so movement is fully traceable.
    let running = previousStock;
    for (const allocation of allocations) {
      const after = running - allocation.quantity;
      await tx.inventoryTransaction.create({
        data: {
          type: params.type ?? "ORDER_DEDUCTION",
          productId: inventory.productId,
          variantId,
          batchId: allocation.batchId,
          quantity: -allocation.quantity,
          previousStock: running,
          newStock: after,
          referenceType:
            params.referenceType ?? (params.orderId ? "ORDER" : undefined),
          referenceId: params.orderId,
          orderId: params.orderId,
          userId: params.userId,
          note: params.note,
        },
      });
      running = after;
    }

    return { allocations, previousStock, newStock };
  },

  /** Returns stock to inventory (order cancellation / customer return). */
  async restoreStock(
    tx: Tx,
    params: {
      variantId: string;
      quantity: number;
      orderId?: string;
      userId?: number;
      type: InventoryTransactionType;
      note?: string;
    }
  ) {
    await this.lockInventoryRow(tx, params.variantId);

    const inventory = await tx.inventory.findUnique({
      where: { variantId: params.variantId },
      select: { productId: true, currentStock: true },
    });
    if (!inventory) throw new NotFoundError("Inventory record");

    const previousStock = inventory.currentStock;
    const newStock = previousStock + params.quantity;

    await tx.inventory.update({
      where: { variantId: params.variantId },
      data: { currentStock: newStock },
    });

    // Put units back into the batches this order consumed, newest expiry last.
    if (params.orderId) {
      const consumed = await tx.inventoryTransaction.findMany({
        where: {
          orderId: params.orderId,
          variantId: params.variantId,
          type: "ORDER_DEDUCTION",
          batchId: { not: null },
        },
        select: { batchId: true, quantity: true },
      });
      let toRestore = params.quantity;
      for (const row of consumed) {
        if (toRestore <= 0) break;
        const give = Math.min(Math.abs(row.quantity), toRestore);
        await tx.inventoryBatch.update({
          where: { id: row.batchId! },
          data: { remainingQuantity: { increment: give } },
        });
        toRestore -= give;
      }
    }

    await tx.inventoryTransaction.create({
      data: {
        type: params.type,
        productId: inventory.productId,
        variantId: params.variantId,
        quantity: params.quantity,
        previousStock,
        newStock,
        referenceType: params.orderId ? "ORDER" : undefined,
        referenceId: params.orderId,
        orderId: params.orderId,
        userId: params.userId,
        note: params.note,
      },
    });

    return { previousStock, newStock };
  },
};
