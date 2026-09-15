import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { forgotPasswordSchema } from "@/validators/auth.validator";
import { authService } from "@/services/auth.service";

export const POST = handle(async (request: NextRequest) => {
  const { email } = await parseBody(request, forgotPasswordSchema);
  const result = await authService.forgotPassword(email);
  return ok(result, result.message);
});
