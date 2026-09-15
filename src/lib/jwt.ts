import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { RoleName } from "@/generated/prisma/enums";

/** Custom claims we put in the token (separate from the registered JWT ones). */
export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  role: RoleName;
  roleId: number;
}

export type SessionPayload = JWTPayload & SessionClaims;

const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short. Set a strong value in .env."
    );
  }
  return new TextEncoder().encode(secret);
}

export const TOKEN_COOKIE = "fmcg_session";

export async function signToken(payload: SessionClaims): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    // A storefront token is signed with the same secret but a different
    // audience. Reject it here so a customer cookie can never be replayed
    // as a staff session.
    if (payload.aud === CUSTOMER_AUDIENCE) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Storefront (customer) tokens
// ---------------------------------------------------------------------------

/** Claims for a signed-in storefront customer. */
export interface CustomerClaims {
  sub: string;
  phone: string;
  name: string;
}

export type CustomerPayload = JWTPayload & CustomerClaims;

export const CUSTOMER_TOKEN_COOKIE = "fmcg_customer";
const CUSTOMER_AUDIENCE = "customer";

export async function signCustomerToken(payload: CustomerClaims): Promise<string> {
  const expiresIn = process.env.CUSTOMER_JWT_EXPIRES_IN || "30d";
  return new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setAudience(CUSTOMER_AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyCustomerToken(
  token: string
): Promise<CustomerPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
      audience: CUSTOMER_AUDIENCE,
    });
    return payload as CustomerPayload;
  } catch {
    return null;
  }
}

export function customerTokenMaxAgeSeconds(): number {
  return durationSeconds(process.env.CUSTOMER_JWT_EXPIRES_IN || "30d", 60 * 60 * 24 * 30);
}

/** Seconds represented by strings like `7d`, `12h`, `30m`. */
function durationSeconds(raw: string, fallback: number): number {
  const match = /^(\d+)([smhd])$/.exec(raw.trim());
  if (!match) return fallback;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 86400;
  return value * multiplier;
}

export function tokenMaxAgeSeconds(): number {
  return durationSeconds(process.env.JWT_EXPIRES_IN || "7d", 60 * 60 * 24 * 7);
}
