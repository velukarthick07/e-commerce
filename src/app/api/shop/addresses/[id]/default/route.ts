import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requireCustomer } from "@/lib/customer-auth";
import { customerAuthService } from "@/services/customer-auth.service";

type Ctx = { params: Promise<{ id: string }> };

/** Promotes one address to the default; the previous default is demoted. */
export const POST = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requireCustomer(request);
  const { id } = await ctx.params;
  return ok(
    await customerAuthService.setDefaultAddress(session.customerId, id),
    "Default delivery address updated"
  );
});
