import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { quickCustomerSchema } from "@/validators/customer.validator";
import { customerService } from "@/services/customer.service";

/** "+ New Customer" from the local-order screen. */
export const POST = handle(async (request: NextRequest) => {
  await requirePermission("customers:create", request);
  const input = await parseBody(request, quickCustomerSchema);
  const { customer, reused } = await customerService.quickCreate(input);

  return reused
    ? ok(customer, `${customer.name} is already registered — selected them instead`)
    : created(customer, "Customer added");
});
