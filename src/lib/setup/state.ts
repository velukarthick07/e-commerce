import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Whether this installation has been through the setup wizard.
 *
 * The answer is a file on disk rather than a database lookup, because the
 * whole point of setup is that there may not be a database yet. The proxy
 * consults this on every request, so it has to stay cheap.
 */
export const LOCK_FILE = ".setup-complete.json";

export interface SetupLock {
  /** ISO timestamp of when setup finished. */
  completedAt: string;
  /** Database the installation was pointed at, for operator reference. */
  database: string;
  /** Email of the administrator created during setup. */
  adminEmail: string;
  /** App version at install time — useful when diagnosing upgrades. */
  version: string;
}

export function projectRoot(): string {
  return process.cwd();
}

export function lockPath(): string {
  return path.join(projectRoot(), LOCK_FILE);
}

/**
 * Cached because `handle()` and the proxy both ask on every request.
 *
 * Only the `true` answer is cached permanently: an installation never becomes
 * un-installed while the server runs, but it very much does go the other way
 * during setup, so `false` is re-checked each time (a single `existsSync` on a
 * path the OS has cached — cheaper than the redirect it guards).
 */
let cachedComplete = false;

export function isSetupComplete(): boolean {
  if (cachedComplete) return true;
  cachedComplete = existsSync(lockPath());
  return cachedComplete;
}

/** Drops the cache after setup finishes (or in tests). */
export function clearSetupCache(): void {
  cachedComplete = false;
}

export function readLock(): SetupLock | null {
  try {
    const raw = readFileSync(lockPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SetupLock>;
    if (!parsed.completedAt) return null;
    return {
      completedAt: parsed.completedAt,
      database: parsed.database ?? "",
      adminEmail: parsed.adminEmail ?? "",
      version: parsed.version ?? "",
    };
  } catch {
    return null;
  }
}

export function writeLock(lock: SetupLock): void {
  writeFileSync(lockPath(), `${JSON.stringify(lock, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  cachedComplete = true;
}

/** Used only by `npm run setup:reset`, never by the running app. */
export function removeLock(): void {
  rmSync(lockPath(), { force: true });
  cachedComplete = false;
}
