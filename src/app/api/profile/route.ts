import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requireAuth } from "@/lib/auth";
import { updateProfileSchema } from "@/validators/user.validator";
import { userService } from "@/services/user.service";

export const PUT = handle(async (request: NextRequest) => {
  const session = await requireAuth(request);
  const input = await parseBody(request, updateProfileSchema);
  return ok(await userService.updateProfile(session.userId, input), "Profile updated");
});
