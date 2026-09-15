import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { listTransactionsQuery } from "@/validators/inventory.validator";
import { inventoryService } from "@/services/inventory.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("inventory:read", request);
  const query = parseQuery(request, listTransactionsQuery);
  const { items, meta } = await inventoryService.listTransactions(query);
  return ok(items, "Inventory transactions loaded", { meta });
});
