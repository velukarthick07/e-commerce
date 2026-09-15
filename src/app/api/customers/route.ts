import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import {
  createCustomerSchema,
  listCustomersQuery,
} from "@/validators/customer.validator";
import { customerService } from "@/services/customer.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("customers:read", request);
  const query = parseQuery(request, listCustomersQuery);

  const { items, meta } = await customerService.list({
    ...query,
    isActive: query.isActive === undefined ? undefined : query.isActive === "true",
  });
  return ok(items, "Customers loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  await requirePermission("customers:create", request);
  const input = await parseBody(request, createCustomerSchema);
  return created(await customerService.create(input), "Customer created successfully");
});
