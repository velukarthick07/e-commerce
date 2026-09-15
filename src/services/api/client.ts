"use client";

import axios, { AxiosError } from "axios";
import type { ApiEnvelopeError, PaginationMetaDto } from "@/types/common";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** Error shape the UI works with — always safe to show to a user. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    code?: string,
    fields?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiEnvelopeError | undefined;
    if (data && typeof data.message === "string") {
      return new ApiError(
        data.message,
        error.response?.status ?? 500,
        data.error?.code,
        data.error?.fields
      );
    }
    if (error.code === "ERR_NETWORK") {
      return new ApiError(
        "Cannot reach the server. Check your connection and try again.",
        0
      );
    }
    return new ApiError(
      "Something went wrong. Please try again.",
      error.response?.status ?? 500
    );
  }
  return new ApiError("Something went wrong. Please try again.", 500);
}

// A 401 anywhere in the admin panel means the staff session is gone — bounce
// to the login screen once. The storefront is excluded: a 401 there is the
// normal answer for a guest hitting a customer-only endpoint, and the shop
// handles it inline rather than throwing the shopper out of their cart.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    if (
      apiError.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/shop")
    ) {
      // A hard navigation is deliberate here: the session is gone, so every
      // cached page and context should be discarded. This runs in an axios
      // interceptor, outside React, where the router is not available.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/login?next=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`;
    }
    return Promise.reject(apiError);
  }
);

export interface Result<T> {
  data: T;
  message: string;
  meta?: PaginationMetaDto & Record<string, unknown>;
}

export async function getList<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<Result<T[]>> {
  const response = await api.get(url, { params: clean(params) });
  return {
    data: response.data.data as T[],
    message: response.data.message,
    meta: response.data.meta,
  };
}

export async function getOne<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await api.get(url, { params: clean(params) });
  return response.data.data as T;
}

export async function post<T>(url: string, body?: unknown): Promise<Result<T>> {
  const response = await api.post(url, body);
  return { data: response.data.data as T, message: response.data.message };
}

export async function put<T>(url: string, body?: unknown): Promise<Result<T>> {
  const response = await api.put(url, body);
  return { data: response.data.data as T, message: response.data.message };
}

export async function patch<T>(url: string, body?: unknown): Promise<Result<T>> {
  const response = await api.patch(url, body);
  return { data: response.data.data as T, message: response.data.message };
}

export async function del<T>(url: string, params?: Record<string, unknown>): Promise<Result<T>> {
  const response = await api.delete(url, { params: clean(params) });
  return { data: response.data.data as T, message: response.data.message };
}

/** Drops empty values so they never reach the API as `?x=` noise. */
export function clean(
  params?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/** Downloads a CSV export without leaving the page. */
export async function downloadCsv(
  url: string,
  params: Record<string, unknown>,
  filename: string
): Promise<void> {
  const response = await api.get(url, {
    params: clean({ ...params, format: "csv" }),
    responseType: "blob",
  });
  const href = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
