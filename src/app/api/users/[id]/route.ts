import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateUserSchema } from "@/validators/user.validator";
import { userService } from "@/services/user.service";
import { BadRequestError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

async function numericId(ctx: Ctx): Promise<number> {
  const { id } = await ctx.params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed)) throw new BadRequestError("Invalid user id");
  return parsed;
}

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("users:read", request);
  return ok(await userService.getById(await numericId(ctx)), "User loaded");
});

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("users:update", request);
  const input = await parseBody(request, updateUserSchema);
  return ok(
    await userService.update(await numericId(ctx), input, session),
    "User updated successfully"
  );
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("users:delete", request);
  return ok(
    await userService.remove(await numericId(ctx), session),
    "User deleted successfully"
  );
});
