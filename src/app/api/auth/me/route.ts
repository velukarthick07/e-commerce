import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authService } from "@/services/auth.service";

export const GET = handle(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const user = await authService.me(session.userId);
  return ok(user, "Session is active");
});
