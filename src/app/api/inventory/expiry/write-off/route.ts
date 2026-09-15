import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

/** Removes every expired batch's remaining stock and records the write-off. */
export const POST = handle(async (request: NextRequest) => {
  const session = await requirePermission("inventory:delete", request);
  const result = await inventoryService.writeOffExpired(session);

  return ok(
    result,
    result.batches === 0
      ? "No expired stock to write off"
      : `Wrote off ${result.units} units across ${result.batches} batch${result.batches === 1 ? "" : "es"}`
  );
});
