import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CUSTOMER_TOKEN_COOKIE,
  TOKEN_COOKIE,
  verifyCustomerToken,
  verifyToken,
} from "@/lib/jwt";
import { isSetupComplete } from "@/lib/setup/state";

/**
 * Next.js 16 renamed Middleware to Proxy. This performs an *optimistic* check
 * only: it keeps signed-out visitors away from pages they cannot use. Real
 * authorisation happens in every route handler via `requirePermission` (staff)
 * or `requireCustomer` (shoppers), which re-read the account from the database.
 *
 * Two independent sessions live side by side. A shopper browsing /shop is not
 * a staff member, and a signed-in staff member is not a shopper — so the
 * storefront is left alone entirely, whichever cookies are present.
 */

/** Staff sign-in screens: reachable signed out, pointless signed in. */
const STAFF_PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

/** The customer-facing shop — open to the world. */
const SHOP_PREFIX = "/shop";

/** The install wizard, which exists only until it has been used. */
const SETUP_PREFIX = "/setup";

/** Shop pages that still need a customer session. */
const SHOP_PRIVATE_PATHS = ["/shop/account"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isSetupPath = pathname === SETUP_PREFIX || pathname.startsWith(`${SETUP_PREFIX}/`);

  // --- Installation gate --------------------------------------------------
  // Until setup has run there is no database, so no page below can render.
  // Afterwards the wizard disappears: it creates the first administrator
  // without authenticating, and must not be reachable on a live store.
  if (!isSetupComplete()) {
    if (isSetupPath) return NextResponse.next();
    const setup = new URL(SETUP_PREFIX, request.url);
    return NextResponse.redirect(setup);
  }
  if (isSetupPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // --- Storefront ---------------------------------------------------------
  if (pathname === SHOP_PREFIX || pathname.startsWith(`${SHOP_PREFIX}/`)) {
    const needsCustomer = SHOP_PRIVATE_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (!needsCustomer) return NextResponse.next();

    const token = request.cookies.get(CUSTOMER_TOKEN_COOKIE)?.value;
    const customer = token ? await verifyCustomerToken(token) : null;
    if (customer) return NextResponse.next();

    const login = new URL("/shop/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  // The landing page decides for itself where to send the visitor.
  if (pathname === "/") return NextResponse.next();

  // --- Admin panel --------------------------------------------------------
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  const isStaffPublic = STAFF_PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!session && !isStaffPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (session && isStaffPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Skip API routes (they guard themselves and must return JSON, not a
   * redirect), Next internals, and static assets.
   */
  matcher: ["/((?!api|_next/static|_next/image|uploads|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico)$).*)"],
};
