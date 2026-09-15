"use client";

import { useEffect, useState } from "react";
import { shopApi, toQuoteItems } from "@/services/api/shop";
import { ApiError } from "@/services/api/client";
import type { CartLine, ShopQuote } from "@/types/shop";
import type { DeliveryType } from "@/generated/prisma/enums";

interface QuoteSnapshot {
  key: string;
  quote: ShopQuote | null;
  error: string | null;
}

/**
 * Keeps a server-priced quote in step with the cart.
 *
 * The browser never adds anything up itself: quantities go to
 * `/api/shop/quote` and the totals come back. That is the same calculation the
 * checkout runs, so the figure on screen is the figure charged.
 *
 * The previous quote stays visible while a new one is in flight — totals that
 * blank out on every keystroke read as a bug to shoppers.
 */
export function useShopQuote(
  items: CartLine[],
  couponCode: string,
  deliveryType: DeliveryType
) {
  const key = JSON.stringify({
    items: toQuoteItems(items),
    couponCode: couponCode.trim().toUpperCase(),
    deliveryType,
  });

  const [snapshot, setSnapshot] = useState<QuoteSnapshot | null>(null);
  const isEmpty = items.length === 0;

  useEffect(() => {
    // An empty cart has nothing to price, and is answered from derived state
    // below rather than by writing state from inside this effect.
    if (isEmpty) return;

    const { items: lines, couponCode: code, deliveryType: mode } = JSON.parse(key) as {
      items: { variantId: string; quantity: number }[];
      couponCode: string;
      deliveryType: DeliveryType;
    };

    let cancelled = false;

    void (async () => {
      try {
        const quote = await shopApi.quote({
          items: lines,
          couponCode: code || undefined,
          deliveryType: mode,
        });
        if (!cancelled) setSnapshot({ key, quote, error: null });
      } catch (error) {
        if (cancelled) return;
        setSnapshot({
          key,
          quote: null,
          error:
            error instanceof ApiError
              ? error.message
              : "Could not price your cart. Please try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, isEmpty]);

  const current = snapshot?.key === key ? snapshot : null;

  return {
    // While a new quote is in flight the previous one is still shown, dimmed
    // by `stale`, so totals never blank out mid-edit.
    quote: isEmpty ? null : (current?.quote ?? snapshot?.quote ?? null),
    error: current?.error ?? null,
    /** True while the displayed totals belong to an earlier cart state. */
    stale: !isEmpty && current === null,
    loaded: isEmpty || current !== null,
  };
}
