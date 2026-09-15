/**
 * Phone numbers are the storefront's identity key, so the same human number
 * typed as "+91 98400 12345", "098400-12345" or "9840012345" must resolve to
 * one customer record. Everything is normalised to bare digits with the
 * Indian country code and trunk prefix stripped.
 */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidPhone(input: string): boolean {
  return /^\d{10}$/.test(normalisePhone(input));
}

/** "9840012345" -> "98400 12345" */
export function formatPhone(input: string): string {
  const n = normalisePhone(input);
  return n.length === 10 ? `${n.slice(0, 5)} ${n.slice(5)}` : input;
}

/** "9840012345" -> "98•••••45" — safe to show before identity is proven. */
export function maskPhone(input: string): string {
  const n = normalisePhone(input);
  if (n.length < 4) return "•".repeat(n.length);
  return `${n.slice(0, 2)}${"•".repeat(Math.max(0, n.length - 4))}${n.slice(-2)}`;
}

/** "Lakshmi Narayanan" -> "L•••••• N••••••••" */
export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]}${"•".repeat(Math.max(1, part.length - 1))}`)
    .join(" ");
}

/** Keeps the locality visible but hides the exact door number / street. */
export function maskAddress(parts: {
  line1: string;
  city: string;
  postalCode: string;
}): string {
  return `${"•".repeat(6)}, ${parts.city} ${parts.postalCode}`;
}
