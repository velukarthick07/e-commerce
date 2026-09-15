import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import {
  CUSTOMER_TOKEN_COOKIE,
  customerTokenMaxAgeSeconds,
  verifyCustomerToken,
} from "./jwt";
import { UnauthorizedError } from "./errors";

export interface CustomerSession {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
}

/**
 * Resolves the signed-in storefront customer. Like the staff equivalent, the
 * row is re-read on every call so deactivating a customer takes effect at once
 * rather than whenever their 30-day token happens to expire.
 *
 * Deliberately separate from `getSession` in `lib/auth.ts`: a staff session
 * grants no storefront identity and a customer session grants no admin access.
 */
export async function getCustomerSession(
  request?: NextRequest
): Promise<CustomerSession | null> {
  let token = request?.cookies.get(CUSTOMER_TOKEN_COOKIE)?.value ?? null;
  if (!token) {
    const store = await cookies();
    token = store.get(CUSTOMER_TOKEN_COOKIE)?.value ?? null;
  }
  if (!token) return null;

  const payload = await verifyCustomerToken(token);
  if (!payload?.sub) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, phone: true, email: true, isActive: true },
  });

  if (!customer || !customer.isActive) return null;

  return {
    customerId: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
  };
}

export async function requireCustomer(
  request?: NextRequest
): Promise<CustomerSession> {
  const session = await getCustomerSession(request);
  if (!session) throw new UnauthorizedError("Please sign in to continue");
  return session;
}

export async function setCustomerSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CUSTOMER_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: customerTokenMaxAgeSeconds(),
  });
}

export async function clearCustomerSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(CUSTOMER_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
