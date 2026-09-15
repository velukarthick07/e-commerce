import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { reportQuery } from "@/validators/report.validator";
import { reportService } from "@/services/report.service";
import { BadRequestError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";

type Ctx = { params: Promise<{ type: string }> };

const REPORTS = {
  sales: reportService.sales,
  orders: reportService.orders,
  products: reportService.products,
  customers: reportService.customers,
  payments: reportService.payments,
  "local-orders": reportService.localOrders,
} as const;

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("reports:read", request);
  const { type } = await ctx.params;
  const query = parseQuery(request, reportQuery);

  const data =
    type === "inventory"
      ? await reportService.inventory()
      : await (REPORTS[type as keyof typeof REPORTS] ??
          (() => {
            throw new BadRequestError(`Unknown report "${type}"`);
          }))(query);

  if (query.format === "csv") {
    const csv = reportService.csvFor(type, serialize(data) as Record<string, unknown>);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return ok(data, "Report generated");
});
