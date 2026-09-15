"use client";

import { useSyncExternalStore } from "react";
import {
  addLine,
  cartCount,
  cartSubtotal,
  clearCart,
  getServerSnapshot,
  getSnapshot,
  removeLine,
  setQuantity,
  subscribe,
} from "@/lib/shop/cart-store";

/**
 * Subscribes to the browser-held cart. Every consumer sees the same lines and
 * re-renders together, without a context provider in between.
 */
export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    items,
    count: cartCount(items),
    subtotal: cartSubtotal(items),
    isEmpty: items.length === 0,
    add: addLine,
    setQuantity,
    remove: removeLine,
    clear: clearCart,
  };
}
