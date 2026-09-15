import { ok, handleOpen } from "@/lib/api-response";
import { assertSetupOpen } from "@/lib/setup/guard";
import { runRequirementChecks } from "@/lib/setup/requirements";

/** The pre-flight checklist. Read-only, so it needs no setup key. */
export const GET = handleOpen(async () => {
  assertSetupOpen();
  const report = await runRequirementChecks();
  return ok(
    report,
    report.ok
      ? "Everything this server needs is in place"
      : `${report.failures} requirement${report.failures === 1 ? "" : "s"} still to resolve`
  );
});
