import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { userService } from "@/services/user.service";

export const GET = handle(async (request: NextRequest) => {
  await requireAuth(request);
  return ok(await userService.listRoles(), "Roles loaded");
});
