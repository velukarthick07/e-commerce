import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import {
  createBatchSchema,
  listBatchesQuery,
} from "@/validators/inventory.validator";
import { inventoryService } from "@/services/inventory.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("inventory:read", request);
  const query = parseQuery(request, listBatchesQuery);
  const { items, meta } = await inventoryService.listBatches(query);
  return ok(items, "Batches loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  const session = await requirePermission("inventory:create", request);
  const input = await parseBody(request, createBatchSchema);
  return created(
    await inventoryService.createBatch(input, session),
    "Batch added and stock updated"
  );
});
