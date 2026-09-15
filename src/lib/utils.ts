import { NotFoundError } from "./errors";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Appends a numeric suffix until `exists` reports the slug is free. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 1;
  while (await exists(candidate)) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginate({ page = 1, limit = 20 }: PaginationInput) {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit) || 20));
  return { skip: (safePage - 1) * safeLimit, take: safeLimit, page: safePage, limit: safeLimit };
}

export function paginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function assertFound<T>(value: T | null | undefined, resource: string): T {
  if (value === null || value === undefined) throw new NotFoundError(resource);
  return value;
}

/** `yyyyMMdd` in the store timezone — used for daily order-number sequences. */
export function dateKey(date = new Date(), timeZone = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Turns a row set into RFC-4180 CSV for report exports. */
export function toCsv(
  rows: Record<string, unknown>[],
  columns?: { key: string; label: string }[]
): string {
  if (rows.length === 0 && !columns) return "";
  const cols =
    columns ?? Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }));
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = cols.map((c) => escape(c.label)).join(",");
  const body = rows.map((row) => cols.map((c) => escape(row[c.key])).join(","));
  return [header, ...body].join("\r\n");
}
