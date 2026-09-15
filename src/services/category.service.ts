import { categoryRepository } from "@/repositories/category.repository";
import { BusinessRuleError } from "@/lib/errors";
import { assertFound, uniqueSlug } from "@/lib/utils";
import type { CreateCategoryInput } from "@/validators/category.validator";

export const categoryService = {
  list: categoryRepository.list,
  tree: categoryRepository.tree,

  async getById(id: number) {
    return assertFound(await categoryRepository.findById(id), "Category");
  },

  async create(input: CreateCategoryInput) {
    if (input.parentId) {
      const parent = await categoryRepository.findById(input.parentId);
      if (!parent) throw new BusinessRuleError("The selected parent category does not exist");
      if (parent.parentId !== null) {
        throw new BusinessRuleError(
          "Categories support two levels — a subcategory cannot have children"
        );
      }
    }

    const slug = await uniqueSlug(input.name, (s) => categoryRepository.slugExists(s));

    return categoryRepository.create({
      name: input.name,
      slug,
      description: input.description || null,
      imageUrl: input.imageUrl || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      ...(input.parentId ? { parent: { connect: { id: input.parentId } } } : {}),
    });
  },

  async update(id: number, input: Partial<CreateCategoryInput>) {
    const existing = await this.getById(id);

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) {
        throw new BusinessRuleError("A category cannot be its own parent");
      }
      if (await categoryRepository.isDescendantOf(input.parentId, id)) {
        throw new BusinessRuleError("Cannot move a category beneath its own subcategory");
      }
      if (existing.children.length > 0) {
        throw new BusinessRuleError(
          "This category has subcategories, so it cannot become a subcategory itself"
        );
      }
    }

    const slug =
      input.name && input.name !== existing.name
        ? await uniqueSlug(input.name, (s) => categoryRepository.slugExists(s, id))
        : undefined;

    return categoryRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug ? { slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.parentId !== undefined
        ? input.parentId === null
          ? { parent: { disconnect: true } }
          : { parent: { connect: { id: input.parentId } } }
        : {}),
    });
  },

  async remove(id: number) {
    await this.getById(id);
    const { products, children } = await categoryRepository.usageCounts(id);

    if (products > 0) {
      throw new BusinessRuleError(
        `This category is used by ${products} product${products === 1 ? "" : "s"}. Move them first.`
      );
    }
    if (children > 0) {
      throw new BusinessRuleError(
        `Delete or move the ${children} subcategor${children === 1 ? "y" : "ies"} first.`
      );
    }

    await categoryRepository.delete(id);
    return { id };
  },
};
