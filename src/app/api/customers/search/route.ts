import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { customerService } from "@/services/customer.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("customers:read", request);
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 15);
  return ok(await customerService.search(q, Math.min(50, Math.max(1, limit))), "Customers found");
});
