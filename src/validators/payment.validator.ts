import { z } from "zod";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";
import { money, optionalFilter, paginationQuery } from "./common.validator";

export const listPaymentsQuery = paginationQuery.extend({
  search: z.string().trim().optional(),
  status: optionalFilter(z.enum(PaymentStatus)),
  method: optionalFilter(z.enum(PaymentMethod)),
  orderId: optionalFilter(z.string()),
  customerId: optionalFilter(z.string()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const recordPaymentSchema = z.object({
  orderId: z.string().min(1, "Order is required"),
  amount: money.refine((v) => v > 0, "Amount must be greater than zero"),
  method: z.enum(PaymentMethod),
  status: z.enum(PaymentStatus).default("PAID"),
  transactionId: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const updatePaymentSchema = z.object({
  status: z.enum(PaymentStatus),
  transactionId: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
