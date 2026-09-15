import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { paginate, paginationMeta } from "@/lib/utils";
import type { CatalogueQuery } from "@/validators/storefront.validator";

/**
 * Everything the public catalogue is allowed to see. Purchase prices, batch
 * records, supplier notes and internal stock thresholds are deliberately
 * absent — shoppers get availability, not warehouse data.
 */
const shopVariantSelect = {
  id: true,
  name: true,
  sku: true,
  mrp: true,
  sellingPrice: true,
  discountPrice: true,
  weightGrams: true,
  volumeMl: true,
  imageUrl: true,
  isDefault: true,
  sortOrder: true,
  inventory: { select: { currentStock: true, reservedStock: true } },
} satisfies Prisma.ProductVariantSelect;

const shopCardSelect = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  images: true,
  shortDescription: true,
  unit: true,
  netQuantity: true,
  mrp: true,
  sellingPrice: true,
  discountPrice: true,
  productType: true,
  isFeatured: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    where: { isActive: true },
    select: shopVariantSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.ProductSelect;

const shopDetailSelect = {
  ...shopCardSelect,
  description: true,
  ingredients: true,
  nutritionalInfo: true,
  allergens: true,
  dietaryInfo: true,
  storageInstructions: true,
  preparationInstructions: true,
  shelfLifeDays: true,
  countryOfOrigin: true,
  manufacturer: true,
  packer: true,
  fssaiLicense: true,
  oilType: true,
  extractionMethod: true,
  packagingType: true,
  fragrance: true,
  weight: true,
  hsnCode: true,
  taxRate: true,
  subcategory: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

/** A product is only sellable if it has at least one active, stocked variant. */
const IN_STOCK: Prisma.ProductWhereInput = {
  variants: {
    some: { isActive: true, inventory: { currentStock: { gt: 0 } } },
  },
};

/** Published = active product, active category, at least one active variant. */
function publishedWhere(): Prisma.ProductWhereInput {
  return {
    isActive: true,
    category: { isActive: true },
    variants: { some: { isActive: true } },
  };
}

export const storefrontRepository = {
  async listProducts(params: CatalogueQuery) {
    const { skip, take, page, limit } = paginate(params);

    const where: Prisma.ProductWhereInput = {
      ...publishedWhere(),
      ...(params.categoryId
        ? {
            OR: [
              { categoryId: params.categoryId },
              { subcategoryId: params.categoryId },
              { category: { parentId: params.categoryId } },
            ],
          }
        : {}),
      ...(params.productType ? { productType: params.productType } : {}),
      ...(params.brand ? { brand: { equals: params.brand, mode: "insensitive" } } : {}),
      ...(params.minPrice !== undefined || params.maxPrice !== undefined
        ? {
            sellingPrice: {
              ...(params.minPrice !== undefined ? { gte: params.minPrice } : {}),
              ...(params.maxPrice !== undefined ? { lte: params.maxPrice } : {}),
            },
          }
        : {}),
      ...(params.featured === "true" ? { isFeatured: true } : {}),
      ...(params.inStockOnly === "true" ? IN_STOCK : {}),
      ...(params.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: params.search, mode: "insensitive" } },
                  { brand: { contains: params.search, mode: "insensitive" } },
                  { shortDescription: { contains: params.search, mode: "insensitive" } },
                  { category: { name: { contains: params.search, mode: "insensitive" } } },
                ],
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = {
      price_asc: [{ sellingPrice: "asc" as const }],
      price_desc: [{ sellingPrice: "desc" as const }],
      newest: [{ createdAt: "desc" as const }],
      name: [{ name: "asc" as const }],
      // "Relevance" with no search term means the merchandised order: the
      // shop's featured picks first, then newest.
      relevance: [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }],
    }[params.sort];

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, select: shopCardSelect, orderBy, skip, take }),
      prisma.product.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  findBySlug(slug: string) {
    return prisma.product.findFirst({
      where: { slug, ...publishedWhere() },
      select: shopDetailSelect,
    });
  },

  related(categoryId: number, excludeProductId: string, take = 4) {
    return prisma.product.findMany({
      where: {
        ...publishedWhere(),
        categoryId,
        id: { not: excludeProductId },
      },
      select: shopCardSelect,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take,
    });
  },

  /** Top-level categories with their children and a live sellable count. */
  async categories() {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        parentId: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Counting has to mirror `listProducts`, which matches a category by its
    // own id, by subcategory, or by being the parent of the product's
    // category. A groupBy on categoryId alone would report 0 for every
    // subcategory — products are filed under the parent with the child in
    // `subcategoryId` — so the pairs are resolved in memory instead. Each
    // product is counted at most once per category.
    const products = await prisma.product.findMany({
      where: publishedWhere(),
      select: { id: true, categoryId: true, subcategoryId: true },
    });

    const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
    const members = new Map<number, Set<string>>();
    const add = (categoryId: number | null, productId: string) => {
      if (categoryId === null) return;
      const set = members.get(categoryId) ?? new Set<string>();
      set.add(productId);
      members.set(categoryId, set);
    };

    for (const product of products) {
      add(product.categoryId, product.id);
      add(product.subcategoryId, product.id);
      add(parentOf.get(product.categoryId) ?? null, product.id);
      if (product.subcategoryId !== null) {
        add(parentOf.get(product.subcategoryId) ?? null, product.id);
      }
    }

    const countFor = (id: number) => members.get(id)?.size ?? 0;

    const byParent = new Map<number | null, typeof rows>();
    for (const row of rows) {
      const list = byParent.get(row.parentId) ?? [];
      list.push(row);
      byParent.set(row.parentId, list);
    }

    return (byParent.get(null) ?? []).map((parent) => ({
      ...parent,
      productCount: countFor(parent.id),
      children: (byParent.get(parent.id) ?? []).map((child) => ({
        ...child,
        productCount: countFor(child.id),
      })),
    }));
  },

  async brands() {
    const rows = await prisma.product.findMany({
      where: { ...publishedWhere(), brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });
    return rows.map((r) => r.brand).filter((b): b is string => Boolean(b));
  },

  /** Availability for a set of variants, used to re-check a cart on load. */
  availability(variantIds: string[]) {
    return prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        isActive: true,
        sellingPrice: true,
        discountPrice: true,
        product: { select: { isActive: true } },
        inventory: { select: { currentStock: true, reservedStock: true } },
      },
    });
  },
};
