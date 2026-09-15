import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import {
  listPaymentsQuery,
  recordPaymentSchema,
} from "@/validators/payment.validator";
import { paymentService } from "@/services/payment.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("payments:read", request);
  const query = parseQuery(request, listPaymentsQuery);
  const { items, meta, collected } = await paymentService.list(query);
  return ok(items, "Payments loaded", { meta: { ...meta, collected } });
});

export const POST = handle(async (request: NextRequest) => {
  const session = await requirePermission("payments:create", request);
  const input = await parseBody(request, recordPaymentSchema);
  return created(await paymentService.record(input, session), "Payment recorded");
});
