"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { shopApi } from "@/services/api/shop";
import type { ShopCustomer } from "@/types/shop";

interface ShopAuthValue {
  customer: ShopCustomer | null;
  loading: boolean;
  /** True once the session has been checked, whoever the visitor turned out to be. */
  ready: boolean;
  signedIn: boolean;
  setCustomer: (customer: ShopCustomer | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const ShopAuthContext = createContext<ShopAuthValue | null>(null);

/**
 * Storefront session, entirely separate from the staff `AuthContext`.
 *
 * A signed-out visitor is the normal case here, not an error — every shop page
 * works without a customer, and this only unlocks saved addresses, order
 * history and prefilled checkout.
 */
export function ShopAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const me = await shopApi.me();
        if (!cancelled) setCustomer(me);
      } catch {
        // 401 simply means "browsing as a guest".
        if (!cancelled) setCustomer(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setCustomer(await shopApi.me());
    } catch {
      setCustomer(null);
    }
  }, []);

  const logout = useCallback(async () => {
    await shopApi.logout().catch(() => undefined);
    setCustomer(null);
  }, []);

  const value = useMemo<ShopAuthValue>(
    () => ({
      customer,
      loading,
      ready,
      signedIn: customer !== null,
      setCustomer,
      refresh,
      logout,
    }),
    [customer, loading, ready, refresh, logout]
  );

  return (
    <ShopAuthContext.Provider value={value}>{children}</ShopAuthContext.Provider>
  );
}

export function useShopAuth(): ShopAuthValue {
  const context = useContext(ShopAuthContext);
  if (!context) {
    throw new Error("useShopAuth must be used inside <ShopAuthProvider>");
  }
  return context;
}
