import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { adjustStockSchema } from "@/validators/inventory.validator";
import { inventoryService } from "@/services/inventory.service";

export const POST = handle(async (request: NextRequest) => {
  const session = await requirePermission("inventory:update", request);
  const input = await parseBody(request, adjustStockSchema);
  const result = await inventoryService.adjust(input, session);
  return ok(result, `Stock updated — new level is ${result.newStock}`);
});
