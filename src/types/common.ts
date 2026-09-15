import type { Prisma } from "@/generated/prisma/client";

/** Prisma client restricted to what is usable inside `$transaction`. */
export type Tx = Prisma.TransactionClient;

export interface ApiEnvelopeSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMetaDto & Record<string, unknown>;
}

export interface ApiEnvelopeError {
  success: false;
  message: string;
  error: { code?: string; fields?: Record<string, string[]>; details?: unknown };
}

export interface PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paged<T> {
  items: T[];
  meta: PaginationMetaDto;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ExpiryBucket =
  | "expired"
  | "7_days"
  | "30_days"
  | "60_days"
  | "normal";
