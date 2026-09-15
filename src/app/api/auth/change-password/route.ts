import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requireAuth } from "@/lib/auth";
import { changePasswordSchema } from "@/validators/auth.validator";
import { authService } from "@/services/auth.service";

export const POST = handle(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const input = await parseBody(request, changePasswordSchema);
  const result = await authService.changePassword(
    session.userId,
    input.currentPassword,
    input.password
  );
  return ok(result, result.message);
});
