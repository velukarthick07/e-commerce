import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { otpRequestSchema } from "@/validators/storefront.validator";
import { customerAuthService } from "@/services/customer-auth.service";

export const POST = handle(async (request: NextRequest) => {
  const { phone } = await parseBody(request, otpRequestSchema);
  const result = await customerAuthService.requestOtp(phone);
  return ok(result, "Verification code sent");
});
