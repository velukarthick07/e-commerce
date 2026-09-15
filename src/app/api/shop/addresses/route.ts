import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requireCustomer } from "@/lib/customer-auth";
import { storefrontAddressSchema } from "@/validators/storefront.validator";
import { customerAuthService } from "@/services/customer-auth.service";

export const GET = handle(async (request: NextRequest) => {
  const session = await requireCustomer(request);
  return ok(
    await customerAuthService.listAddresses(session.customerId),
    "Addresses loaded"
  );
});

export const POST = handle(async (request: NextRequest) => {
  const session = await requireCustomer(request);
  const input = await parseBody(request, storefrontAddressSchema);
  return created(
    await customerAuthService.addAddress(session.customerId, input),
    "Address saved"
  );
});
