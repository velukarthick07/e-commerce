import { userRepository } from "@/repositories/user.repository";
import { hashPassword } from "@/lib/password";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { assertFound } from "@/lib/utils";
import type { RoleName } from "@/generated/prisma/enums";
import type { CreateUserInput, UpdateUserInput } from "@/validators/user.validator";
import type { AuthSession } from "@/lib/auth";

async function roleIdFor(role: RoleName): Promise<number> {
  const row = await userRepository.findRoleByName(role);
  if (!row) throw new NotFoundError(`Role ${role}`);
  return row.id;
}

export const userService = {
  list: userRepository.list,
  listRoles: userRepository.listRoles,

  async getById(id: number) {
    return assertFound(await userRepository.findById(id), "User");
  },

  async create(input: CreateUserInput) {
    const existing = await userRepository.findByEmailWithSecret(input.email);
    if (existing) throw new ConflictError("A user with this email already exists");

    return userRepository.create({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
      isActive: input.isActive,
      role: { connect: { id: await roleIdFor(input.role) } },
    });
  },

  async update(id: number, input: UpdateUserInput, session: AuthSession) {
    const user = await this.getById(id);

    // Guard against removing the last active super admin.
    const demoting =
      user.role.name === "SUPER_ADMIN" &&
      ((input.role && input.role !== "SUPER_ADMIN") || input.isActive === false);
    if (demoting) {
      const remaining = await userRepository.countByRole("SUPER_ADMIN");
      if (remaining <= 1) {
        throw new BusinessRuleError(
          "The last active super admin cannot be demoted or deactivated"
        );
      }
    }

    if (session.userId === id && input.isActive === false) {
      throw new BusinessRuleError("You cannot deactivate your own account");
    }

    return userRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      ...(input.role ? { role: { connect: { id: await roleIdFor(input.role) } } } : {}),
    });
  },

  async remove(id: number, session: AuthSession) {
    const user = await this.getById(id);

    if (session.userId === id) {
      throw new BusinessRuleError("You cannot delete your own account");
    }
    if (user.role.name === "SUPER_ADMIN") {
      const remaining = await userRepository.countByRole("SUPER_ADMIN");
      if (remaining <= 1) {
        throw new BusinessRuleError("The last super admin cannot be deleted");
      }
    }

    await userRepository.delete(id);
    return { id };
  },

  async updateProfile(
    userId: number,
    input: { name: string; email: string; phone?: string; avatarUrl?: string }
  ) {
    return userRepository.update(userId, {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl || null } : {}),
    });
  },
};
