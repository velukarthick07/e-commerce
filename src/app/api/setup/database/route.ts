import { ok, handleOpen } from "@/lib/api-response";
import { BadRequestError } from "@/lib/errors";
import { describeDbError, inspectServer } from "@/lib/setup/database";
import { assertSetupKey, assertSetupOpen } from "@/lib/setup/guard";
import { testDatabaseSchema } from "@/validators/setup.validator";

/**
 * Tests the supplied credentials and reports what setup would do with them,
 * without changing anything. Guarded by the setup key because it makes an
 * outbound connection on the caller's behalf.
 */
export const POST = handleOpen(async (request: Request) => {
  assertSetupOpen();
  const body = testDatabaseSchema.parse(await request.json());
  assertSetupKey(body.key);

  try {
    const report = await inspectServer(body.database);
    return ok(report, report.message);
  } catch (error) {
    throw new BadRequestError(describeDbError(error));
  }
});
