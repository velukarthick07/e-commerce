import { prisma } from "@/lib/prisma";
import { productRepository } from "@/repositories/product.repository";
import { categoryRepository } from "@/repositories/category.repository";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertFound, uniqueSlug } from "@/lib/utils";
import type { CreateProductInput, VariantInput } from "@/validators/product.validator";
import type { Tx } from "@/types/common";
import type { AuthSession } from "@/lib/auth";

/** Exactly one variant must be the default; fall back to the first. */
function normaliseVariants(variants: VariantInput[]): VariantInput[] {
  const hasDefault = variants.some((v) => v.isDefault && v.isActive !== false);
  return variants.map((v, i) => ({
    ...v,
    sku: v.sku.trim().toUpperCase(),
    barcode: v.barcode?.trim() || undefined,
    isDefault: hasDefault ? v.isDefault : i === 0,
    sortOrder: v.sortOrder || i,
  }));
}

async function assertCategories(categoryId: number, subcategoryId: number | null) {
  const category = await categoryRepository.findById(categoryId);
  if (!category) throw new NotFoundError("Category");

  if (subcategoryId) {
    const sub = await categoryRepository.findById(subcategoryId);
    if (!sub) throw new NotFoundError("Subcategory");
    if (sub.parentId !== categoryId) {
      throw new BusinessRuleError(
        "The selected subcategory does not belong to the selected category"
      );
    }
  }
}

function scalarFields(input: CreateProductInput) {
  return {
    name: input.name,
    sku: input.sku.trim().toUpperCase(),
    barcode: input.barcode?.trim() || null,
    brand: input.brand || null,
    description: input.description || null,
    shortDescription: input.shortDescription || null,
    images: input.images ?? [],
    mrp: input.mrp,
    sellingPrice: input.sellingPrice,
    discountPrice: input.discountPrice ?? null,
    taxRate: input.taxRate,
    hsnCode: input.hsnCode || null,
    minStock: input.minStock,
    maxStock: input.maxStock,
    unit: input.unit,
    netQuantity: input.netQuantity || null,
    weight: input.weight ?? null,
    lengthCm: input.lengthCm ?? null,
    widthCm: input.widthCm ?? null,
    heightCm: input.heightCm ?? null,
    isFeatured: input.isFeatured,
    isActive: input.isActive,
    productType: input.productType,
    ingredients: input.ingredients || null,
    nutritionalInfo: input.nutritionalInfo ?? undefined,
    allergens: input.allergens || null,
    dietaryInfo: input.dietaryInfo || null,
    storageInstructions: input.storageInstructions || null,
    preparationInstructions: input.preparationInstructions || null,
    shelfLifeDays: input.shelfLifeDays ?? null,
    countryOfOrigin: input.countryOfOrigin || null,
    manufacturer: input.manufacturer || null,
    packer: input.packer || null,
    fssaiLicense: input.fssaiLicense || null,
    oilType: input.oilType || null,
    extractionMethod: input.extractionMethod,
    packagingType: input.packagingType || null,
    fragrance: input.fragrance || null,
  };
}

/** Creates the variant row plus its 1:1 inventory record and opening batch. */
async function createVariant(
  tx: Tx,
  productId: string,
  variant: VariantInput,
  userId?: number
) {
  const created = await tx.productVariant.create({
    data: {
      productId,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode || null,
      mrp: variant.mrp,
      sellingPrice: variant.sellingPrice,
      discountPrice: variant.discountPrice ?? null,
      weightGrams: variant.weightGrams ?? null,
      volumeMl: variant.volumeMl ?? null,
      imageUrl: variant.imageUrl || null,
      isDefault: variant.isDefault,
      isActive: variant.isActive,
      sortOrder: variant.sortOrder,
    },
    select: { id: true },
  });

  await tx.inventory.create({
    data: {
      productId,
      variantId: created.id,
      currentStock: variant.openingStock,
      minStock: variant.minStock,
      maxStock: variant.maxStock,
      lastRestockedAt: variant.openingStock > 0 ? new Date() : null,
    },
  });

  if (variant.openingStock > 0) {
    await tx.inventoryTransaction.create({
      data: {
        type: "STOCK_ADDED",
        productId,
        variantId: created.id,
        quantity: variant.openingStock,
        previousStock: 0,
        newStock: variant.openingStock,
        referenceType: "OPENING_STOCK",
        userId,
        note: "Opening stock",
      },
    });
  }

  return created.id;
}

export const productService = {
  list: productRepository.list,
  search: productRepository.search,
  distinctBrands: productRepository.distinctBrands,

  async getById(id: string) {
    return assertFound(await productRepository.findById(id), "Product");
  },

  async lookupBarcode(barcode: string) {
    const variant = await productRepository.findVariantByBarcode(barcode.trim());
    if (!variant) throw new NotFoundError(`No product matches barcode ${barcode}`);
    return variant;
  },

  async create(input: CreateProductInput, session: AuthSession) {
    await assertCategories(input.categoryId, input.subcategoryId);

    const sku = input.sku.trim().toUpperCase();
    if (await productRepository.skuExists(sku)) {
      throw new ConflictError(`A product with SKU ${sku} already exists`);
    }

    const variants = normaliseVariants(input.variants);
    const slug = await uniqueSlug(input.name, (s) => productRepository.slugExists(s));

    const productId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...scalarFields(input),
          sku,
          slug,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
        },
        select: { id: true },
      });

      for (const variant of variants) {
        await createVariant(tx, product.id, variant, session.userId);
      }

      return product.id;
    });

    return this.getById(productId);
  },

  /**
   * Updates the product and reconciles its variants: existing ones are
   * updated, new ones created (with inventory), and removed ones deactivated
   * rather than deleted so historical order lines keep resolving.
   */
  async update(id: string, input: CreateProductInput, session: AuthSession) {
    const existing = await this.getById(id);
    await assertCategories(input.categoryId, input.subcategoryId);

    const sku = input.sku.trim().toUpperCase();
    if (await productRepository.skuExists(sku, id)) {
      throw new ConflictError(`A product with SKU ${sku} already exists`);
    }

    const variants = normaliseVariants(input.variants);
    const incomingIds = new Set(variants.map((v) => v.id).filter(Boolean) as string[]);
    const removed = existing.variants.filter((v) => !incomingIds.has(v.id));

    if (removed.length === existing.variants.length && variants.every((v) => !v.id)) {
      // Everything replaced — still fine, but keep at least one active variant.
      if (variants.length === 0) {
        throw new BusinessRuleError("A product must keep at least one variant");
      }
    }

    const slug =
      input.name !== existing.name
        ? await uniqueSlug(input.name, (s) => productRepository.slugExists(s))
        : existing.slug;

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...scalarFields(input),
          sku,
          slug,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
        },
      });

      for (const variant of variants) {
        if (variant.id && existing.variants.some((v) => v.id === variant.id)) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode || null,
              mrp: variant.mrp,
              sellingPrice: variant.sellingPrice,
              discountPrice: variant.discountPrice ?? null,
              weightGrams: variant.weightGrams ?? null,
              volumeMl: variant.volumeMl ?? null,
              imageUrl: variant.imageUrl || null,
              isDefault: variant.isDefault,
              isActive: variant.isActive,
              sortOrder: variant.sortOrder,
            },
          });
          await tx.inventory.updateMany({
            where: { variantId: variant.id },
            data: { minStock: variant.minStock, maxStock: variant.maxStock },
          });
        } else {
          await createVariant(tx, id, variant, session.userId);
        }
      }

      // Deactivate rather than delete — order history references these rows.
      for (const variant of removed) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { isActive: false, isDefault: false },
        });
      }
    });

    return this.getById(id);
  },

  async remove(id: string) {
    await this.getById(id);

    const orderCount = await productRepository.countOrderItems(id);
    if (orderCount > 0) {
      throw new BusinessRuleError(
        `This product appears in ${orderCount} order${orderCount === 1 ? "" : "s"}. Deactivate it instead of deleting.`
      );
    }

    await productRepository.delete(id);
    return { id };
  },

  async setActive(id: string, isActive: boolean) {
    await this.getById(id);
    await productRepository.update(id, { isActive });
    return this.getById(id);
  },
};
