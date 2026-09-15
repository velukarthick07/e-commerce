import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requireCustomer } from "@/lib/customer-auth";
import { customerAuthService } from "@/services/customer-auth.service";

export const GET = handle(async (request: NextRequest) => {
  const session = await requireCustomer(request);
  return ok(await customerAuthService.me(session.customerId), "Profile loaded");
});
