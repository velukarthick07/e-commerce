import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { updateStoreSettingsSchema } from "@/validators/settings.validator";
import { settingsService } from "@/services/settings.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("settings:read", request);
  return ok(await settingsService.get(), "Settings loaded");
});

export const PUT = handle(async (request: NextRequest) => {
  await requirePermission("settings:update", request);
  const input = await parseBody(request, updateStoreSettingsSchema);
  return ok(await settingsService.update(input), "Settings saved");
});
