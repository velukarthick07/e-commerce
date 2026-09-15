import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { setMinMaxSchema } from "@/validators/inventory.validator";
import { inventoryService } from "@/services/inventory.service";

export const PATCH = handle(async (request: NextRequest) => {
  await requirePermission("inventory:update", request);
  const input = await parseBody(request, setMinMaxSchema);
  return ok(
    await inventoryService.setMinMax(input.variantId, input.minStock, input.maxStock),
    "Stock thresholds updated"
  );
});
