import { ok, handleOpen } from "@/lib/api-response";
import { keyRequired, hasKeyFile } from "@/lib/setup/key";
import { isSetupComplete, readLock } from "@/lib/setup/state";
import type { SetupStatus } from "@/types/setup";

/**
 * The one setup endpoint that stays available after installation, so the
 * wizard in the browser can tell "finished" from "connection dropped".
 */
export const GET = handleOpen(async () => {
  const complete = isSetupComplete();
  const status: SetupStatus = {
    required: !complete,
    keyRequired: !complete && keyRequired() && hasKeyFile(),
    completedAt: complete ? readLock()?.completedAt : undefined,
  };
  return ok(status, complete ? "Setup is already complete" : "Setup is required");
});
