import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { createOrderSchema, listOrdersQuery } from "@/validators/order.validator";
import { orderService } from "@/services/order.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("orders:read", request);
  const query = parseQuery(request, listOrdersQuery);
  const { items, meta } = await orderService.list(query);
  return ok(items, "Orders loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  const session = await requirePermission("orders:create", request);
  const input = await parseBody(request, createOrderSchema);
  const order = await orderService.create(input, session);
  return created(order, `Order ${order.orderNumber} created successfully`);
});
