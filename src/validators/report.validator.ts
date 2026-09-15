import { z } from "zod";
import { OrderChannel } from "@/generated/prisma/enums";
import { optionalFilter } from "./common.validator";

export const PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "custom",
] as const;

export const reportQuery = z.object({
  preset: z.enum(PRESETS).default("last_30_days"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  channel: optionalFilter(z.enum(OrderChannel)),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
  format: z.enum(["json", "csv"]).default("json"),
});

export const dashboardQuery = z.object({
  salesRange: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

export type ReportQuery = z.infer<typeof reportQuery>;
