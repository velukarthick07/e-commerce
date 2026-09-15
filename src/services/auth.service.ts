import { randomBytes, createHash } from "node:crypto";
import { userRepository } from "@/repositories/user.repository";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { BadRequestError, UnauthorizedError } from "@/lib/errors";
import { permissionsForRole } from "@/lib/permissions";
import type { LoginInput, ResetPasswordInput } from "@/validators/auth.validator";

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const authService = {
  async login(input: LoginInput) {
    const user = await userRepository.findByEmailWithSecret(input.email);

    // Same message for unknown email and wrong password — do not reveal which.
    if (!user) throw new UnauthorizedError("Invalid email or password");

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    if (!user.isActive) {
      throw new UnauthorizedError("This account has been deactivated");
    }

    const token = await signToken({
      sub: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role.name,
      roleId: user.roleId,
    });

    await userRepository.touchLastLogin(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role.name,
        roleLabel: user.role.label,
        permissions: permissionsForRole(user.role.name),
      },
    };
  },

  async me(userId: number) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError("Session is no longer valid");
    return {
      ...user,
      role: user.role.name,
      roleLabel: user.role.label,
      permissions: permissionsForRole(user.role.name),
    };
  },

  /**
   * Issues a password reset token. The response never reveals whether the
   * address exists; the raw token is returned only outside production so the
   * flow is testable without an email provider wired up.
   */
  async forgotPassword(email: string) {
    const user = await userRepository.findByEmailWithSecret(email);
    const generic = {
      message:
        "If an account exists for that email, a reset link has been sent.",
      resetToken: undefined as string | undefined,
    };

    if (!user || !user.isActive) return generic;

    const rawToken = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await userRepository.setResetToken(user.id, hashToken(rawToken), expires);

    // TODO: dispatch through an email provider once one is configured.
    if (process.env.NODE_ENV !== "production") {
      generic.resetToken = rawToken;
    }
    return generic;
  },

  async resetPassword(input: ResetPasswordInput) {
    const user = await userRepository.findByResetToken(hashToken(input.token));

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestError("This reset link is invalid or has expired");
    }

    await userRepository.setPassword(user.id, await hashPassword(input.password));
    return { message: "Password updated. You can now sign in." };
  },

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await userRepository.findByIdWithSecret(userId);
    if (!user) throw new UnauthorizedError();

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestError("Your current password is incorrect");

    await userRepository.setPassword(user.id, await hashPassword(newPassword));
    return { message: "Password changed successfully" };
  },
};
