import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { RoleName } from "@/generated/prisma/enums";
import { paginate, paginationMeta } from "@/lib/utils";

export const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  roleId: true,
  role: { select: { id: true, name: true, label: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  /** Includes the password hash — only for the login flow. */
  findByEmailWithSecret(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id }, select: userSafeSelect });
  },

  findByIdWithSecret(id: number) {
    return prisma.user.findUnique({ where: { id }, include: { role: true } });
  },

  findByResetToken(token: string) {
    return prisma.user.findUnique({ where: { passwordResetToken: token } });
  },

  async list(params: {
    page: number;
    limit: number;
    search?: string;
    role?: RoleName;
    isActive?: boolean;
  }) {
    const { skip, take, page, limit } = paginate(params);
    const where: Prisma.UserWhereInput = {
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.role ? { role: { name: params.role } } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
              { phone: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSafeSelect,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, meta: paginationMeta(total, page, limit) };
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data, select: userSafeSelect });
  },

  update(id: number, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, select: userSafeSelect });
  },

  delete(id: number) {
    return prisma.user.delete({ where: { id } });
  },

  touchLastLogin(id: number) {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: { id: true },
    });
  },

  setResetToken(id: number, token: string | null, expires: Date | null) {
    return prisma.user.update({
      where: { id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
      select: { id: true },
    });
  },

  setPassword(id: number, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
      select: { id: true },
    });
  },

  countByRole(role: RoleName) {
    return prisma.user.count({ where: { role: { name: role }, isActive: true } });
  },

  findRoleByName(name: RoleName) {
    return prisma.role.findUnique({ where: { name } });
  },

  listRoles() {
    return prisma.role.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, label: true, description: true },
    });
  },
};
