import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { dashboardQuery } from "@/validators/report.validator";
import { reportService } from "@/services/report.service";

export const GET = handle(async (request: NextRequest) => {
  await requirePermission("dashboard:read", request);
  const { salesRange } = parseQuery(request, dashboardQuery);
  return ok(await reportService.dashboard(salesRange), "Dashboard loaded");
});
