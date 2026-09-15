import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { getCustomerSession, requireCustomer } from "@/lib/customer-auth";
import { placeOrderSchema } from "@/validators/storefront.validator";
import { storefrontService } from "@/services/storefront.service";

/** The signed-in customer's own orders. */
export const GET = handle(async (request: NextRequest) => {
  const session = await requireCustomer(request);
  const { items, total } = await storefrontService.myOrders(session.customerId);
  return ok(items, "Orders loaded", { meta: { total } });
});

/**
 * Places an order. Works signed in or as a guest — the session, when present,
 * only unlocks saved addresses and pins the order to that account.
 */
export const POST = handle(async (request: NextRequest) => {
  const session = await getCustomerSession(request);
  const input = await parseBody(request, placeOrderSchema);
  const order = await storefrontService.placeOrder(input, session);
  return created(order, `Order ${order.orderNumber} placed successfully`);
});
