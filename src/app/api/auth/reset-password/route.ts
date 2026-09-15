import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { resetPasswordSchema } from "@/validators/auth.validator";
import { authService } from "@/services/auth.service";

export const POST = handle(async (request: NextRequest) => {
  const input = await parseBody(request, resetPasswordSchema);
  const result = await authService.resetPassword(input);
  return ok(result, result.message);
});
