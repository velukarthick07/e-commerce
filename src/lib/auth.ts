import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { TOKEN_COOKIE, verifyToken, tokenMaxAgeSeconds } from "./jwt";
import { ForbiddenError, UnauthorizedError } from "./errors";
import type { PermissionKey } from "./permissions";
import { permissionsForRole, roleHasPermission } from "./permissions";
import { RoleName } from "@/generated/prisma/enums";

export { hashPassword, verifyPassword } from "./password";

export interface AuthSession {
  userId: number;
  email: string;
  name: string;
  role: RoleName;
  roleId: number;
  permissions: PermissionKey[];
}

function bearerFrom(request?: NextRequest): string | null {
  const header = request?.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

/**
 * Resolves the caller's session from the httpOnly cookie, or an
 * `Authorization: Bearer` header for non-browser API clients.
 *
 * The user row is re-read on every call so that deactivating a user or
 * changing their role takes effect immediately rather than when their
 * token expires.
 */
export async function getSession(
  request?: NextRequest
): Promise<AuthSession | null> {
  let token = bearerFrom(request);
  if (!token) {
    const store = await cookies();
    token = store.get(TOKEN_COOKIE)?.value ?? null;
  }
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.sub) return null;

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      roleId: true,
      role: { select: { name: true } },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    roleId: user.roleId,
    permissions: permissionsForRole(user.role.name),
  };
}

export async function requireAuth(request?: NextRequest): Promise<AuthSession> {
  const session = await getSession(request);
  if (!session) throw new UnauthorizedError("Please sign in to continue");
  return session;
}

/**
 * Authorisation gate for protected routes. Never rely on the client having
 * hidden a button — every mutating endpoint calls this.
 */
export async function requirePermission(
  permission: PermissionKey,
  request?: NextRequest
): Promise<AuthSession> {
  const session = await requireAuth(request);
  if (!roleHasPermission(session.role, permission)) {
    throw new ForbiddenError(
      `Your role (${session.role.replace("_", " ").toLowerCase()}) cannot perform this action`
    );
  }
  return session;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: tokenMaxAgeSeconds(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
