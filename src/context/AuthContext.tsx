"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getOne, post } from "@/services/api/client";
import type { CurrentUser } from "@/types/models";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: CurrentUser | null;
}) {
  const pathname = usePathname();
  // The install wizard runs before there is a database to hold a session in,
  // so asking who is signed in there can only ever fail.
  const isSetup = pathname?.startsWith("/setup") ?? false;

  const [user, setUser] = useState<CurrentUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser && !isSetup);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      setUser(await getOne<CurrentUser>("/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser || isSetup) return;
    let cancelled = false;

    void (async () => {
      try {
        const current = await getOne<CurrentUser>("/auth/me");
        if (!cancelled) setUser(current);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialUser, isSetup]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await post<{ user: CurrentUser; token: string }>("/auth/login", {
      email,
      password,
    });
    setUser(result.data.user);
    setLoading(false);
    return result.data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    setUser(null);
    router.replace("/login");
    router.refresh();
  }, [router]);

  /** Mirrors the server-side permission matrix for showing/hiding UI. */
  const can = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, can, login, logout, refresh }),
    [user, loading, can, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
