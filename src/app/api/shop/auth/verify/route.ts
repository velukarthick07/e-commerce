import { z } from "zod";
import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { setCustomerSessionCookie } from "@/lib/customer-auth";
import { otpVerifySchema } from "@/validators/storefront.validator";
import { customerAuthService } from "@/services/customer-auth.service";

const schema = otpVerifySchema.extend({
  /** Supplied on the second call when the number has no account yet. */
  name: z.string().trim().min(2, "Name is required").max(120).optional(),
});

export const POST = handle(async (request: NextRequest) => {
  const input = await parseBody(request, schema);
  const result = await customerAuthService.verifyOtp(
    input.phone,
    input.code,
    input.name
  );

  if (result.needsName) {
    return ok(result, "Almost there — tell us your name");
  }

  await setCustomerSessionCookie(result.token);
  return ok(
    { customer: result.customer, isNew: result.isNew },
    result.isNew
      ? `Welcome, ${result.customer.name}`
      : `Welcome back, ${result.customer.name}`
  );
});
