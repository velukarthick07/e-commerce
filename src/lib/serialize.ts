/**
 * Prisma returns Decimal instances and Date objects. Decimals serialise to
 * JSON strings, which would force the UI to parse every price, so we convert
 * the whole payload once on the way out: Decimal -> number, Date -> ISO string.
 */
function isDecimalLike(value: unknown): value is { toNumber(): number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toFixed?: unknown }).toFixed === "function" &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  );
}

export function serialize<T>(input: T): T {
  return transform(input) as T;
}

function transform(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (isDecimalLike(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(transform);
  if (typeof value === "object") {
    if (Buffer.isBuffer(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = transform(val);
    }
    return out;
  }
  return value;
}
