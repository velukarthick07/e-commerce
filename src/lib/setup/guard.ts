import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { verifyKey, keyRequired } from "./key";
import { isSetupComplete } from "./state";

/**
 * Setup endpoints exist only while the application is uninstalled. Once the
 * lock file is written they behave as though they were never deployed, so a
 * live store cannot be re-provisioned by anyone who finds the URL.
 */
export function assertSetupOpen(): void {
  if (isSetupComplete()) {
    throw new NotFoundError("Setup");
  }
}

/** Proves the caller can read this server's console or filesystem. */
export function assertSetupKey(key: string | null | undefined): void {
  if (!keyRequired()) return;
  if (!verifyKey(key)) {
    throw new UnauthorizedError(
      "That setup key is not correct. It is printed in the server console at startup, and saved in the .setup-key file."
    );
  }
}
