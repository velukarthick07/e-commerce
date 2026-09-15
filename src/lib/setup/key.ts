import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./state";

/**
 * A one-time key that proves whoever is running setup can read the server's
 * filesystem or console.
 *
 * Without it, the window between "server is up" and "setup is finished" is a
 * window in which any stranger who can reach the port can create the first
 * administrator. The key closes that window at the cost of one paste, and is
 * deleted the moment setup succeeds.
 *
 * Set SETUP_REQUIRE_KEY=false to skip it on a machine that is not reachable
 * from anywhere else.
 */
export const KEY_FILE = ".setup-key";

export function keyPath(): string {
  return path.join(projectRoot(), KEY_FILE);
}

export function keyRequired(): boolean {
  return String(process.env.SETUP_REQUIRE_KEY ?? "true").toLowerCase() !== "false";
}

export function readKey(): string | null {
  try {
    const value = readFileSync(keyPath(), "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

/** Creates the key on first boot; returns the existing one on later boots. */
export function ensureKey(): string {
  const existing = readKey();
  if (existing) return existing;

  const key = randomBytes(16)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .slice(0, 20)
    .toUpperCase()
    .replace(/(.{5})(?=.)/g, "$1-");

  writeFileSync(keyPath(), `${key}\n`, { encoding: "utf8", mode: 0o600 });
  return key;
}

export function clearKey(): void {
  rmSync(keyPath(), { force: true });
}

export function hasKeyFile(): boolean {
  return existsSync(keyPath());
}

/** Constant-time comparison so the key cannot be recovered by timing. */
export function verifyKey(supplied: string | null | undefined): boolean {
  if (!keyRequired()) return true;

  const expected = readKey();
  if (!expected) return false;

  const a = Buffer.from(expected.trim().toUpperCase());
  const b = Buffer.from(String(supplied ?? "").trim().toUpperCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
