"use client";

import type { CartLine } from "@/types/shop";

const STORAGE_KEY = "fmcg_shop_cart_v1";

/**
 * The cart lives in localStorage rather than on the server: a shopper can fill
 * it without an account, and nothing in it is trusted anyway — `/api/shop/quote`
 * and the checkout both re-read prices and stock from the database.
 *
 * It is exposed as an external store (rather than React state in a provider)
 * so components can subscribe with `useSyncExternalStore`. That reads the
 * browser's copy during render instead of assigning it in an effect, which
 * keeps server and client renders honest and avoids a flash of "0 items".
 */

const EMPTY: CartLine[] = [];

let lines: CartLine[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private-browsing quota errors must never break checkout.
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.variantId === "string" &&
    typeof line.productName === "string" &&
    typeof line.quantity === "number" &&
    line.quantity > 0
  );
}

function hydrate() {
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) lines = parsed.filter(isCartLine);
  } catch {
    lines = EMPTY;
  }
}

function commit(next: CartLine[]) {
  lines = next;
  persist();
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): CartLine[] {
  if (!hydrated) hydrate();
  return lines;
}

/** The server has no localStorage, so it always renders an empty cart. */
export function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

/** Adds to the quantity already in the cart, capped at what is in stock. */
export function addLine(line: CartLine): void {
  const current = getSnapshot();
  const existing = current.find((l) => l.variantId === line.variantId);
  const cap = Math.max(1, line.availableStock);

  if (!existing) {
    commit([...current, { ...line, quantity: Math.min(line.quantity, cap) }]);
    return;
  }

  commit(
    current.map((l) =>
      l.variantId === line.variantId
        ? { ...l, ...line, quantity: Math.min(l.quantity + line.quantity, cap) }
        : l
    )
  );
}

export function setQuantity(variantId: string, quantity: number): void {
  const current = getSnapshot();
  if (quantity <= 0) {
    commit(current.filter((l) => l.variantId !== variantId));
    return;
  }
  commit(
    current.map((l) =>
      l.variantId === variantId
        ? { ...l, quantity: Math.min(quantity, Math.max(1, l.availableStock)) }
        : l
    )
  );
}

export function removeLine(variantId: string): void {
  commit(getSnapshot().filter((l) => l.variantId !== variantId));
}

export function clearCart(): void {
  commit(EMPTY);
}

export function cartCount(items: CartLine[]): number {
  return items.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartSubtotal(items: CartLine[]): number {
  return items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
