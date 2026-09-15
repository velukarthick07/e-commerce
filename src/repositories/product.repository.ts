import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductType } from "@/generated/prisma/enums";
import { paginate, paginationMeta } from "@/lib/utils";
import type { StockStatus, Tx } from "@/types/common";

export const variantSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  mrp: true,
  sellingPrice: true,
  discountPrice: true,
  weightGrams: true,
  volumeMl: true,
  imageUrl: true,
  isDefault: true,
  isActive: true,
  sortOrder: true,
  inventory: {
    select: {
      id: true,
      currentStock: true,
      reservedStock: true,
      minStock: true,
      maxStock: true,
      lastRestockedAt: true,
    },
  },
} satisfies Prisma.ProductVariantSelect;

export const productListSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  barcode: true,
  brand: true,
  images: true,
  shortDescription: true,
  mrp: true,
  sellingPrice: true,
  discountPrice: true,
  taxRate: true,
  unit: true,
  netQuantity: true,
  minStock: true,
  isFeatured: true,
  isActive: true,
  productType: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  variants: { select: variantSelect, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductSelect;

/** Narrows a product query to a stock condition evaluated per variant. */
function stockStatusFilter(status: StockStatus): Prisma.ProductWhereInput {
  if (status === "out_of_stock") {
    return {
      variants: {
        every: { OR: [{ inventory: null }, { inventory: { currentStock: { lte: 0 } } }] },
      },
    };
  }
  if (status === "low_stock") {
    return {
      variants: {
        some: {
          inventory: {
            currentStock: { gt: 0, lte: prisma.inventory.fields.minStock },
          },
        },
      },
    };
  }
  return {
    variants: {
      some: {
        inventory: { currentStock: { gt: prisma.inventory.fields.minStock } },
      },
    },
  };
}

export const productRepository = {
  findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, parentId: true } },
        subcategory: { select: { id: true, name: true } },
        variants: {
          select: variantSelect,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  },

  findBySlug(slug: string) {
    return prisma.product.findUnique({ where: { slug } });
  },

  skuExists(sku: string, exceptId?: string) {
    return prisma.product
      .count({ where: { sku, ...(exceptId ? { id: { not: exceptId } } : {}) } })
      .then((n) => n > 0);
  },

  slugExists(slug: string) {
    return prisma.product.count({ where: { slug } }).then((n) => n > 0);
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: number;
    subcategoryId?: number;
    brand?: string;
    productType?: ProductType;
    isActive?: boolean;
    isFeatured?: boolean;
    stockStatus?: StockStatus;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  }) {
    const { skip, take, page, limit } = paginate(params);

    const where: Prisma.ProductWhereInput = {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.isFeatured !== undefined ? { isFeatured: params.isFeatured } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.subcategoryId ? { subcategoryId: params.subcategoryId } : {}),
      ...(params.brand ? { brand: { equals: params.brand, mode: "insensitive" } } : {}),
      ...(params.productType ? { productType: params.productType } : {}),
      ...(params.stockStatus ? stockStatusFilter(params.stockStatus) : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { sku: { contains: params.search, mode: "insensitive" } },
              { barcode: { contains: params.search, mode: "insensitive" } },
              { brand: { contains: params.search, mode: "insensitive" } },
              {
                variants: {
                  some: {
                    OR: [
                      { sku: { contains: params.search, mode: "insensitive" } },
                      { barcode: { contains: params.search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const sortable: Record<string, Prisma.ProductOrderByWithRelationInput> = {
      name: { name: params.sortOrder },
      sellingPrice: { sellingPrice: params.sortOrder },
      createdAt: { createdAt: params.sortOrder },
      sku: { sku: params.sortOrder },
    };
    const orderBy = sortable[params.sortBy ?? "createdAt"] ?? {
      createdAt: params.sortOrder,
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, select: productListSelect, orderBy, skip, take }),
      prisma.product.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  /**
   * Type-ahead used by the local-order screen. Matches product name, SKU,
   * barcode and brand, plus variant SKU/barcode, and returns only sellable
   * (active) rows with live stock.
   */
  search(params: { q: string; categoryId?: number; limit: number }) {
    const q = params.q.trim();
    return prisma.product.findMany({
      where: {
        isActive: true,
        ...(params.categoryId
          ? {
              OR: [
                { categoryId: params.categoryId },
                { subcategoryId: params.categoryId },
                { category: { parentId: params.categoryId } },
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
                { brand: { contains: q, mode: "insensitive" } },
                {
                  variants: {
                    some: {
                      OR: [
                        { sku: { contains: q, mode: "insensitive" } },
                        { barcode: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        brand: true,
        images: true,
        unit: true,
        taxRate: true,
        category: { select: { id: true, name: true } },
        variants: {
          where: { isActive: true },
          select: variantSelect,
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        },
      },
      orderBy: { name: "asc" },
      take: params.limit,
    });
  },

  /** Barcode scan: resolve directly to a single sellable variant. */
  async findVariantByBarcode(barcode: string) {
    const variant = await prisma.productVariant.findFirst({
      where: { OR: [{ barcode }, { sku: barcode }], isActive: true },
      select: {
        ...variantSelect,
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            taxRate: true,
            unit: true,
            isActive: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (variant?.product.isActive) return variant;

    // Fall back to a product-level barcode, resolving to its default variant.
    const product = await prisma.product.findFirst({
      where: { OR: [{ barcode }, { sku: barcode }], isActive: true },
      select: {
        id: true,
        name: true,
        images: true,
        taxRate: true,
        unit: true,
        isActive: true,
        category: { select: { id: true, name: true } },
        variants: {
          where: { isActive: true },
          select: variantSelect,
          orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
          take: 1,
        },
      },
    });
    if (!product || product.variants.length === 0) return null;
    const { variants, ...rest } = product;
    return { ...variants[0], product: rest };
  },

  create(data: Prisma.ProductCreateInput, tx: Tx | typeof prisma = prisma) {
    return tx.product.create({ data, select: { id: true } });
  },

  update(id: string, data: Prisma.ProductUpdateInput, tx: Tx | typeof prisma = prisma) {
    return tx.product.update({ where: { id }, data, select: { id: true } });
  },

  delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  countOrderItems(productId: string) {
    return prisma.orderItem.count({ where: { productId } });
  },

  distinctBrands() {
    return prisma.product
      .findMany({
        where: { brand: { not: null } },
        distinct: ["brand"],
        select: { brand: true },
        orderBy: { brand: "asc" },
      })
      .then((rows) => rows.map((r) => r.brand).filter((b): b is string => !!b));
  },
};
