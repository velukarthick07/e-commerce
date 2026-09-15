import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { listBatchesQuery } from "@/validators/inventory.validator";
import { inventoryService } from "@/services/inventory.service";

/** Expiry Management: bucket counts plus the filtered batch list. */
export const GET = handle(async (request: NextRequest) => {
  await requirePermission("inventory:read", request);
  const query = parseQuery(request, listBatchesQuery);

  const [summary, batches] = await Promise.all([
    inventoryService.expirySummary(),
    inventoryService.listBatches(query),
  ]);

  return ok({ summary, batches: batches.items }, "Expiry data loaded", {
    meta: batches.meta,
  });
});
