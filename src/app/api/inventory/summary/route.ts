import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("inventory:read", request);
  return ok(await inventoryService.summary(), "Inventory summary loaded");
});
