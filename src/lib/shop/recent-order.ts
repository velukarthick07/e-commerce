"use client";

/**
 * The order a shopper just placed, remembered for the confirmation screen.
 *
 * Guests have no session, so the confirmation page would otherwise have no way
 * to prove they are allowed to see the order. sessionStorage is used rather
 * than a query string so the mobile number never lands in the URL, browser
 * history or a referrer header.
 */
const KEY = "fmcg_shop_recent_orders_v1";
const MAX = 10;

interface RecentOrder {
  orderNumber: string;
  phone: string;
}

function read(): RecentOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentOrder[]) : [];
  } catch {
    return [];
  }
}

export function rememberOrder(orderNumber: string, phone: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [{ orderNumber, phone }, ...read().filter((o) => o.orderNumber !== orderNumber)];
    window.sessionStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // Storage being unavailable only costs the shopper an extra form.
  }
}

export function recallOrderPhone(orderNumber: string): string | null {
  return read().find((o) => o.orderNumber === orderNumber)?.phone ?? null;
}
