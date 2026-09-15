"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getList, getOne } from "@/services/api/client";
import type { PaginationMetaDto } from "@/types/common";

interface ListSnapshot<T> {
  /** The request these results belong to — also drives the loading flag. */
  key: string;
  items: T[];
  meta?: PaginationMetaDto & Record<string, unknown>;
  error: string | null;
}

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to load data";
}

/**
 * Fetches a paginated list and re-fetches whenever `params` change.
 *
 * `loading` is derived by comparing the request the results came from with the
 * current one, so no state is set synchronously inside the effect (which would
 * cause a cascading render). Stale responses are discarded.
 */
export function useList<T>(
  url: string,
  params: Record<string, unknown>,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const serialised = JSON.stringify(params);
  const requestKey = `${url}|${serialised}`;

  const [snapshot, setSnapshot] = useState<ListSnapshot<T> | null>(null);
  const [nonce, setNonce] = useState(0);

  const loading = enabled && snapshot?.key !== requestKey;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = await getList<T>(url, JSON.parse(serialised));
        if (!cancelled) {
          setSnapshot({ key: requestKey, items: result.data, meta: result.meta, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setSnapshot({ key: requestKey, items: [], error: message(error) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, serialised, requestKey, enabled, nonce]);

  /** Re-runs the current query — used after a create, update or delete. */
  const reload = useCallback(async () => {
    setNonce((n) => n + 1);
  }, []);

  return {
    items: snapshot?.key === requestKey ? snapshot.items : [],
    meta: snapshot?.key === requestKey ? snapshot.meta : undefined,
    loading,
    error: snapshot?.key === requestKey ? snapshot.error : null,
    reload,
  };
}

/** Fetches a single record, with the same derived-loading approach. */
export function useOne<T>(url: string | null, params?: Record<string, unknown>) {
  const serialised = JSON.stringify(params ?? {});
  const requestKey = url ? `${url}|${serialised}` : null;

  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: T | null;
    error: string | null;
  } | null>(null);
  const [nonce, setNonce] = useState(0);

  const loading = requestKey !== null && snapshot?.key !== requestKey;

  useEffect(() => {
    if (!url || !requestKey) return;
    let cancelled = false;

    void (async () => {
      try {
        const data = await getOne<T>(url, JSON.parse(serialised));
        if (!cancelled) setSnapshot({ key: requestKey, data, error: null });
      } catch (error) {
        if (!cancelled) setSnapshot({ key: requestKey, data: null, error: message(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, serialised, requestKey, nonce]);

  const reload = useCallback(async () => {
    setNonce((n) => n + 1);
  }, []);

  /** Lets a page apply a server response without another round trip. */
  const setData = useCallback(
    (data: T) => {
      if (requestKey) setSnapshot({ key: requestKey, data, error: null });
    },
    [requestKey]
  );

  return {
    data: snapshot?.key === requestKey ? snapshot.data : null,
    loading,
    error: snapshot?.key === requestKey ? snapshot.error : null,
    reload,
    setData,
  };
}
