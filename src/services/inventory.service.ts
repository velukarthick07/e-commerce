import { prisma } from "@/lib/prisma";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { settingsRepository } from "@/repositories/settings.repository";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertFound, startOfDay } from "@/lib/utils";
import type { AdjustStockInput, CreateBatchInput } from "@/validators/inventory.validator";
import type { ExpiryBucket } from "@/types/common";
import type { AuthSession } from "@/lib/auth";

/** Movement direction for each manual transaction type. */
const INCREASES: Record<string, boolean> = {
  STOCK_ADDED: true,
  RETURN: true,
  STOCK_REMOVED: false,
  EXPIRED_STOCK: false,
  MANUAL_ADJUSTMENT: true, // signed by the caller's intent below
};

export function bucketFor(expiryDate: Date | null | undefined): ExpiryBucket {
  if (!expiryDate) return "normal";
  const today = startOfDay(new Date());
  const days = Math.floor(
    (startOfDay(new Date(expiryDate)).getTime() - today.getTime()) / 86_400_000
  );
  if (days < 0) return "expired";
  if (days <= 7) return "7_days";
  if (days <= 30) return "30_days";
  if (days <= 60) return "60_days";
  return "normal";
}

export const inventoryService = {
  list: inventoryRepository.list,
  listBatches: inventoryRepository.listBatches,
  listTransactions: inventoryRepository.listTransactions,
  expirySummary: inventoryRepository.expirySummary,

  async summary() {
    const [total, outOfStock, lowStock, inStock] = await inventoryRepository.summary();
    return { total, inStock, lowStock, outOfStock };
  },

  async getByVariant(variantId: string) {
    return assertFound(
      await inventoryRepository.findByVariant(variantId),
      "Inventory record"
    );
  },

  async setMinMax(variantId: string, minStock: number, maxStock: number) {
    if (maxStock > 0 && maxStock < minStock) {
      throw new BusinessRuleError("Maximum stock must be greater than minimum stock");
    }
    await this.getByVariant(variantId);
    return inventoryRepository.setMinMax(variantId, minStock, maxStock);
  },

  /**
   * Manual stock movement. Increases go to a batch when one is named;
   * decreases consume FEFO so expiring stock is written off first.
   */
  async adjust(input: AdjustStockInput, session: AuthSession) {
    const inventory = await this.getByVariant(input.variantId);
    const increases = INCREASES[input.type] ?? true;

    return prisma.$transaction(async (tx) => {
      if (increases) {
        await inventoryRepository.lockInventoryRow(tx, input.variantId);

        const current = await tx.inventory.findUnique({
          where: { variantId: input.variantId },
          select: { currentStock: true, productId: true },
        });
        if (!current) throw new NotFoundError("Inventory record");

        const previousStock = current.currentStock;
        const newStock = previousStock + input.quantity;

        await tx.inventory.update({
          where: { variantId: input.variantId },
          data: { currentStock: newStock, lastRestockedAt: new Date() },
        });

        if (input.batchId) {
          await tx.inventoryBatch.update({
            where: { id: input.batchId },
            data: {
              remainingQuantity: { increment: input.quantity },
              quantity: { increment: input.quantity },
            },
          });
        }

        await tx.inventoryTransaction.create({
          data: {
            type: input.type,
            productId: current.productId,
            variantId: input.variantId,
            batchId: input.batchId || null,
            quantity: input.quantity,
            previousStock,
            newStock,
            referenceType: "MANUAL",
            userId: session.userId,
            note: input.note || null,
          },
        });

        return { previousStock, newStock };
      }

      // Decrease — reuse FEFO so batch remainders stay consistent.
      const available = inventory.currentStock - inventory.reservedStock;
      if (available < input.quantity) {
        throw new BusinessRuleError(
          `Cannot remove ${input.quantity} units — only ${available} available`
        );
      }

      const result = await inventoryRepository.deductStockFEFO(tx, {
        variantId: input.variantId,
        quantity: input.quantity,
        userId: session.userId,
        blockExpired: false,
        note: input.note || input.type,
        type: input.type,
        referenceType: "MANUAL",
      });

      return { previousStock: result.previousStock, newStock: result.newStock };
    });
  },

  // ---- Batches -----------------------------------------------------------

  async getBatch(id: string) {
    return assertFound(await inventoryRepository.findBatchById(id), "Batch");
  },

  /** Creating a batch also adds its quantity to sellable stock. */
  async createBatch(input: CreateBatchInput, session: AuthSession) {
    const inventory = await this.getByVariant(input.variantId);

    const duplicate = await prisma.inventoryBatch.findFirst({
      where: { variantId: input.variantId, batchNumber: input.batchNumber.trim() },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError(
        `Batch ${input.batchNumber} already exists for this variant`
      );
    }

    const batchId = await prisma.$transaction(async (tx) => {
      await inventoryRepository.lockInventoryRow(tx, input.variantId);

      const batch = await tx.inventoryBatch.create({
        data: {
          batchNumber: input.batchNumber.trim(),
          productId: inventory.product.id,
          variantId: input.variantId,
          manufacturingDate: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate ?? null,
          bestBeforeDate: input.bestBeforeDate ?? null,
          quantity: input.quantity,
          remainingQuantity: input.quantity,
          purchasePrice: input.purchasePrice ?? null,
          mrp: input.mrp ?? null,
          sellingPrice: input.sellingPrice ?? null,
          receivedDate: input.receivedDate,
        },
        select: { id: true },
      });

      const current = await tx.inventory.findUnique({
        where: { variantId: input.variantId },
        select: { currentStock: true },
      });
      const previousStock = current?.currentStock ?? 0;
      const newStock = previousStock + input.quantity;

      await tx.inventory.update({
        where: { variantId: input.variantId },
        data: { currentStock: newStock, lastRestockedAt: new Date() },
      });

      await tx.inventoryTransaction.create({
        data: {
          type: "STOCK_ADDED",
          productId: inventory.product.id,
          variantId: input.variantId,
          batchId: batch.id,
          quantity: input.quantity,
          previousStock,
          newStock,
          referenceType: "BATCH",
          referenceId: batch.id,
          userId: session.userId,
          note: `Batch ${input.batchNumber} received`,
        },
      });

      return batch.id;
    });

    return this.getBatch(batchId);
  },

  /** Edits batch metadata; quantity changes flow through as adjustments. */
  async updateBatch(id: string, input: CreateBatchInput, session: AuthSession) {
    const batch = await this.getBatch(id);
    const consumed = batch.quantity - batch.remainingQuantity;

    if (input.quantity < consumed) {
      throw new BusinessRuleError(
        `${consumed} units from this batch have already been sold, so the quantity cannot be lower`
      );
    }

    const delta = input.quantity - batch.quantity;

    await prisma.$transaction(async (tx) => {
      await inventoryRepository.lockInventoryRow(tx, batch.variantId);

      await tx.inventoryBatch.update({
        where: { id },
        data: {
          batchNumber: input.batchNumber.trim(),
          manufacturingDate: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate ?? null,
          bestBeforeDate: input.bestBeforeDate ?? null,
          quantity: input.quantity,
          remainingQuantity: batch.remainingQuantity + delta,
          purchasePrice: input.purchasePrice ?? null,
          mrp: input.mrp ?? null,
          sellingPrice: input.sellingPrice ?? null,
          receivedDate: input.receivedDate,
        },
      });

      if (delta !== 0) {
        const current = await tx.inventory.findUnique({
          where: { variantId: batch.variantId },
          select: { currentStock: true },
        });
        const previousStock = current?.currentStock ?? 0;
        const newStock = previousStock + delta;

        await tx.inventory.update({
          where: { variantId: batch.variantId },
          data: { currentStock: newStock },
        });

        await tx.inventoryTransaction.create({
          data: {
            type: "MANUAL_ADJUSTMENT",
            productId: batch.productId,
            variantId: batch.variantId,
            batchId: id,
            quantity: delta,
            previousStock,
            newStock,
            referenceType: "BATCH",
            referenceId: id,
            userId: session.userId,
            note: `Batch ${input.batchNumber} quantity corrected`,
          },
        });
      }
    });

    return this.getBatch(id);
  },

  /** Removes a batch and the stock it still holds. */
  async removeBatch(id: string, session: AuthSession) {
    const batch = await this.getBatch(id);

    await prisma.$transaction(async (tx) => {
      await inventoryRepository.lockInventoryRow(tx, batch.variantId);

      if (batch.remainingQuantity > 0) {
        const current = await tx.inventory.findUnique({
          where: { variantId: batch.variantId },
          select: { currentStock: true },
        });
        const previousStock = current?.currentStock ?? 0;
        const newStock = Math.max(0, previousStock - batch.remainingQuantity);

        await tx.inventory.update({
          where: { variantId: batch.variantId },
          data: { currentStock: newStock },
        });

        await tx.inventoryTransaction.create({
          data: {
            type: "STOCK_REMOVED",
            productId: batch.productId,
            variantId: batch.variantId,
            quantity: -batch.remainingQuantity,
            previousStock,
            newStock,
            referenceType: "BATCH_DELETED",
            userId: session.userId,
            note: `Batch ${batch.batchNumber} removed`,
          },
        });
      }

      await tx.inventoryBatch.delete({ where: { id } });
    });

    return { id };
  },

  /** Writes off every expired batch still holding stock. */
  async writeOffExpired(session: AuthSession) {
    const today = startOfDay(new Date());
    const expired = await prisma.inventoryBatch.findMany({
      where: {
        isActive: true,
        remainingQuantity: { gt: 0 },
        expiryDate: { not: null, lt: today },
      },
      select: {
        id: true,
        batchNumber: true,
        productId: true,
        variantId: true,
        remainingQuantity: true,
      },
    });

    let unitsWrittenOff = 0;

    for (const batch of expired) {
      await prisma.$transaction(async (tx) => {
        await inventoryRepository.lockInventoryRow(tx, batch.variantId);

        const current = await tx.inventory.findUnique({
          where: { variantId: batch.variantId },
          select: { currentStock: true },
        });
        const previousStock = current?.currentStock ?? 0;
        const newStock = Math.max(0, previousStock - batch.remainingQuantity);

        await tx.inventory.update({
          where: { variantId: batch.variantId },
          data: { currentStock: newStock },
        });

        await tx.inventoryTransaction.create({
          data: {
            type: "EXPIRED_STOCK",
            productId: batch.productId,
            variantId: batch.variantId,
            batchId: batch.id,
            quantity: -batch.remainingQuantity,
            previousStock,
            newStock,
            referenceType: "EXPIRY_WRITE_OFF",
            userId: session.userId,
            note: `Batch ${batch.batchNumber} expired`,
          },
        });

        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { remainingQuantity: 0, isActive: false },
        });
      });

      unitsWrittenOff += batch.remainingQuantity;
    }

    return { batches: expired.length, units: unitsWrittenOff };
  },

  async settings() {
    return settingsRepository.get();
  },
};
