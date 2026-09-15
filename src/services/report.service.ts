import { reportRepository, type RangeInput } from "@/repositories/report.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { addDays, endOfDay, startOfDay, toCsv } from "@/lib/utils";
import { BadRequestError } from "@/lib/errors";
import type { ReportQuery } from "@/validators/report.validator";
import type { OrderChannel } from "@/generated/prisma/enums";

/** Turns a preset (or explicit dates) into a concrete inclusive range. */
export function resolveRange(query: {
  preset: ReportQuery["preset"];
  from?: Date;
  to?: Date;
}): { from: Date; to: Date } {
  const now = new Date();

  switch (query.preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = addDays(now, -1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last_7_days":
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
    case "last_30_days":
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) };
    case "this_month":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    case "custom": {
      if (!query.from || !query.to) {
        throw new BadRequestError("A custom range needs both a start and end date");
      }
      if (query.from > query.to) {
        throw new BadRequestError("The start date must be before the end date");
      }
      return { from: startOfDay(query.from), to: endOfDay(query.to) };
    }
  }
}

export const reportService = {
  /** Everything the dashboard needs, in one round trip. */
  async dashboard(salesRange: "daily" | "weekly" | "monthly") {
    const [
      cards,
      salesSeries,
      ordersOverview,
      statusBreakdown,
      topProducts,
      lowStock,
      expiring,
    ] = await Promise.all([
      reportRepository.summaryCards(),
      reportRepository.salesSeries(salesRange),
      reportRepository.ordersOverview(),
      reportRepository.statusBreakdown(),
      reportRepository.topProducts({ limit: 6 }),
      reportRepository.lowStock(6),
      reportRepository.expiringBatches(30, 6),
    ]);

    return {
      cards,
      salesSeries,
      ordersOverview,
      statusBreakdown,
      topProducts,
      lowStock,
      expiring,
    };
  },

  async sales(query: ReportQuery) {
    const range = resolveRange(query);
    const input: RangeInput = { ...range, channel: query.channel as OrderChannel };

    const [summary, byPeriod, byCategory, byOrderType, topProducts] =
      await Promise.all([
        reportRepository.salesSummary(input),
        reportRepository.salesByPeriod(input, query.groupBy),
        reportRepository.salesByCategory(input),
        reportRepository.salesByOrderType(input),
        reportRepository.topProducts({ ...range, limit: 10 }),
      ]);

    return { range, summary, byPeriod, byCategory, byOrderType, topProducts };
  },

  async orders(query: ReportQuery) {
    const range = resolveRange(query);
    const input: RangeInput = { ...range, channel: query.channel as OrderChannel };

    const [summary, byPeriod, byOrderType, statusBreakdown] = await Promise.all([
      reportRepository.salesSummary(input),
      reportRepository.salesByPeriod(input, query.groupBy),
      reportRepository.salesByOrderType(input),
      reportRepository.statusBreakdown(),
    ]);

    return { range, summary, byPeriod, byOrderType, statusBreakdown };
  },

  async products(query: ReportQuery) {
    const range = resolveRange(query);
    const [top, low, byCategory] = await Promise.all([
      reportRepository.topProducts({ ...range, limit: 20 }),
      reportRepository.lowPerformingProducts({ ...range, limit: 20 }),
      reportRepository.salesByCategory({ ...range }),
    ]);
    return { range, topProducts: top, lowPerforming: low, byCategory };
  },

  async customers(query: ReportQuery) {
    const range = resolveRange(query);
    const [top, newCustomers, summary] = await Promise.all([
      reportRepository.topCustomers(range, 20),
      reportRepository.newCustomers(range),
      reportRepository.salesSummary(range),
    ]);
    return { range, topCustomers: top, newCustomers, summary };
  },

  async inventory() {
    const [valuation, summaryCounts, expiry, lowStock] = await Promise.all([
      reportRepository.inventoryValuation(),
      inventoryRepository.summary(),
      inventoryRepository.expirySummary(),
      reportRepository.lowStock(50),
    ]);

    const [total, outOfStock, low, inStock] = summaryCounts;
    return {
      valuation,
      counts: { total, inStock, lowStock: low, outOfStock },
      expiry,
      lowStock,
    };
  },

  async payments(query: ReportQuery) {
    const range = resolveRange(query);
    const [breakdown, summary] = await Promise.all([
      reportRepository.paymentsBreakdown(range),
      reportRepository.salesSummary(range),
    ]);
    return { range, breakdown, summary };
  },

  async localOrders(query: ReportQuery) {
    const range = resolveRange(query);
    const input: RangeInput = { ...range, channel: "LOCAL" };

    const [summary, byPeriod, byOrderType, topProducts] = await Promise.all([
      reportRepository.salesSummary(input),
      reportRepository.salesByPeriod(input, query.groupBy),
      reportRepository.salesByOrderType(input),
      reportRepository.topProducts({ ...range, limit: 10 }),
    ]);

    return { range, summary, byPeriod, byOrderType, topProducts };
  },

  /** CSV rendering for the export buttons on every report tab. */
  csvFor(report: string, data: Record<string, unknown>): string {
    switch (report) {
      case "sales":
      case "orders":
      case "local-orders":
        return toCsv(data.byPeriod as Record<string, unknown>[], [
          { key: "bucket", label: "Period" },
          { key: "orders", label: "Orders" },
          { key: "grossSales", label: "Gross Sales" },
          { key: "discounts", label: "Discounts" },
          { key: "tax", label: "Tax" },
          { key: "netSales", label: "Net Sales" },
        ]);
      case "products":
        return toCsv(data.topProducts as Record<string, unknown>[], [
          { key: "name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "units", label: "Units Sold" },
          { key: "revenue", label: "Revenue" },
          { key: "avgPrice", label: "Avg Selling Price" },
        ]);
      case "customers":
        return toCsv(data.topCustomers as Record<string, unknown>[], [
          { key: "name", label: "Customer" },
          { key: "phone", label: "Phone" },
          { key: "orders", label: "Orders" },
          { key: "revenue", label: "Total Spent" },
        ]);
      case "payments":
        return toCsv(data.breakdown as Record<string, unknown>[], [
          { key: "method", label: "Method" },
          { key: "status", label: "Status" },
          { key: "count", label: "Count" },
          { key: "amount", label: "Amount" },
        ]);
      case "inventory": {
        const rows = (data.lowStock as Record<string, unknown>[]).map((r) => {
          const product = r.product as { name?: string; unit?: string };
          const variant = r.variant as { name?: string; sku?: string };
          return {
            product: product?.name ?? "",
            variant: variant?.name ?? "",
            sku: variant?.sku ?? "",
            currentStock: r.currentStock,
            minStock: r.minStock,
          };
        });
        return toCsv(rows, [
          { key: "product", label: "Product" },
          { key: "variant", label: "Variant" },
          { key: "sku", label: "SKU" },
          { key: "currentStock", label: "Current Stock" },
          { key: "minStock", label: "Minimum Stock" },
        ]);
      }
      default:
        throw new BadRequestError(`No CSV export is available for "${report}"`);
    }
  },
};
