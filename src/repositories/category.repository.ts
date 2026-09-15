import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { paginate, paginationMeta } from "@/lib/utils";

const baseSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export const categoryRepository = {
  findById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      select: {
        ...baseSelect,
        parent: { select: { id: true, name: true } },
        children: { select: baseSelect, orderBy: { sortOrder: "asc" } },
        _count: { select: { products: true, subProducts: true, children: true } },
      },
    });
  },

  slugExists(slug: string, exceptId?: number) {
    return prisma.category
      .count({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) } })
      .then((n) => n > 0);
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    parentId?: number;
    isActive?: boolean;
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.CategoryWhereInput = {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.parentId !== undefined ? { parentId: params.parentId } : {}),
      ...(params.search
        ? { name: { contains: params.search, mode: "insensitive" } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        select: {
          ...baseSelect,
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, subProducts: true, children: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip,
        take,
      }),
      prisma.category.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  /** Full two-level tree for pickers and the local-order category rail. */
  tree(activeOnly = false) {
    return prisma.category.findMany({
      where: {
        parentId: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      select: {
        ...baseSelect,
        _count: { select: { products: true } },
        children: {
          where: activeOnly ? { isActive: true } : {},
          select: { ...baseSelect, _count: { select: { products: true } } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  },

  create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data, select: baseSelect });
  },

  update(id: number, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data, select: baseSelect });
  },

  delete(id: number) {
    return prisma.category.delete({ where: { id } });
  },

  async usageCounts(id: number) {
    const [products, subProducts, children] = await Promise.all([
      prisma.product.count({ where: { categoryId: id } }),
      prisma.product.count({ where: { subcategoryId: id } }),
      prisma.category.count({ where: { parentId: id } }),
    ]);
    return { products: products + subProducts, children };
  },

  /** Guards against making a category its own ancestor. */
  async isDescendantOf(candidateId: number, ancestorId: number): Promise<boolean> {
    let cursor: number | null = candidateId;
    const seen = new Set<number>();
    while (cursor !== null) {
      if (cursor === ancestorId && seen.size > 0) return true;
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      const row: { parentId: number | null } | null =
        await prisma.category.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
      cursor = row?.parentId ?? null;
    }
    return false;
  },
};
