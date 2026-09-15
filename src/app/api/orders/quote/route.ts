import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { quoteOrderSchema } from "@/validators/order.validator";
import { orderService } from "@/services/order.service";

/**
 * Server-authoritative pricing preview. The cart calls this on every change
 * so the figures on screen are the ones the backend will charge.
 */
export const POST = handle(async (request: NextRequest) => {
  await requirePermission("local-orders:read", request);
  const input = await parseBody(request, quoteOrderSchema);
  return ok(await orderService.quote(input), "Totals calculated");
});
