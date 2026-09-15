import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/validators/auth.validator";
import { authService } from "@/services/auth.service";

export const POST = handle(async (request: NextRequest) => {
  const input = await parseBody(request, loginSchema);
  const result = await authService.login(input);

  await setSessionCookie(result.token);

  return ok(result, `Welcome back, ${result.user.name}`);
});
