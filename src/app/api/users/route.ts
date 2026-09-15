import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { parseBody, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { createUserSchema, listUsersQuery } from "@/validators/user.validator";
import { userService } from "@/services/user.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("users:read", request);
  const query = parseQuery(request, listUsersQuery);
  const { items, meta } = await userService.list({
    ...query,
    isActive: query.isActive === undefined ? undefined : query.isActive === "true",
  });
  return ok(items, "Users loaded", { meta });
});

export const POST = handle(async (request: NextRequest) => {
  await requirePermission("users:create", request);
  const input = await parseBody(request, createUserSchema);
  return created(await userService.create(input), "User created successfully");
});
