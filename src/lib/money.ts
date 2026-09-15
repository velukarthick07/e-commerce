/**
 * Money helpers.
 *
 * All order arithmetic runs in integer paise so that repeated percentage and
 * discount operations cannot accumulate binary floating-point drift. Values
 * cross the DB/API boundary as 2-decimal rupee numbers.
 */
export type MoneyInput = number | string | { toString(): string } | null | undefined;

export function toPaise(value: MoneyInput): number {
  if (value === null || value === undefined) return 0;
  const asNumber =
    typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(asNumber)) return 0;
  return Math.round(asNumber * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/** Percentage of an integer-paise amount, rounded half-up to the paisa. */
export function percentOfPaise(paise: number, percent: MoneyInput): number {
  const pct = typeof percent === "number" ? percent : Number(percent?.toString() ?? 0);
  if (!Number.isFinite(pct)) return 0;
  return Math.round((paise * pct) / 100);
}

export function clampPaise(paise: number, min: number, max: number): number {
  return Math.min(Math.max(paise, min), max);
}

export function formatCurrency(value: MoneyInput, symbol = "₹"): string {
  const amount = typeof value === "number" ? value : Number(value?.toString() ?? 0);
  return `${symbol}${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
