import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requireCustomer } from "@/lib/customer-auth";
import { storefrontAddressSchema } from "@/validators/storefront.validator";
import { customerAuthService } from "@/services/customer-auth.service";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requireCustomer(request);
  const { id } = await ctx.params;
  const input = await parseBody(request, storefrontAddressSchema);
  return ok(
    await customerAuthService.updateAddress(session.customerId, id, input),
    "Address updated"
  );
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requireCustomer(request);
  const { id } = await ctx.params;
  return ok(
    await customerAuthService.removeAddress(session.customerId, id),
    "Address removed"
  );
});
