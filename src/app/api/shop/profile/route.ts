import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requireCustomer } from "@/lib/customer-auth";
import { updateCustomerProfileSchema } from "@/validators/storefront.validator";
import { customerAuthService } from "@/services/customer-auth.service";

/**
 * The mobile number is the account key and is proven by OTP, so it is not
 * editable here — changing it would mean re-verifying the new number.
 */
export const PATCH = handle(async (request: NextRequest) => {
  const session = await requireCustomer(request);
  const input = await parseBody(request, updateCustomerProfileSchema);
  return ok(
    await customerAuthService.updateProfile(session.customerId, input),
    "Profile updated"
  );
});
