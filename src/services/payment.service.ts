import { prisma } from "@/lib/prisma";
import { paymentRepository } from "@/repositories/payment.repository";
import { BusinessRuleError } from "@/lib/errors";
import { assertFound } from "@/lib/utils";
import { toPaise } from "@/lib/money";
import type { RecordPaymentInput } from "@/validators/payment.validator";
import type { AuthSession } from "@/lib/auth";

export const paymentService = {
  list: paymentRepository.list,

  async getById(id: string) {
    return assertFound(await paymentRepository.findById(id), "Payment");
  },

  /** Records a payment against an order and keeps the order's status in sync. */
  async record(input: RecordPaymentInput, session: AuthSession) {
    const order = assertFound(
      await prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, customerId: true, grandTotal: true, status: true },
      }),
      "Order"
    );

    if (order.status === "CANCELLED") {
      throw new BusinessRuleError("Cannot record a payment against a cancelled order");
    }

    const alreadyPaid = await paymentRepository.sumPaidForOrder(input.orderId);
    const duePaise = toPaise(order.grandTotal) - toPaise(alreadyPaid);

    if (input.status === "PAID" && toPaise(input.amount) > duePaise) {
      throw new BusinessRuleError(
        `This order only has ₹${(duePaise / 100).toFixed(2)} outstanding`,
        { due: duePaise / 100 }
      );
    }

    const paymentId = await prisma.$transaction(async (tx) => {
      const paymentNumber = await paymentRepository.nextPaymentNumber(tx);

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          orderId: order.id,
          customerId: order.customerId,
          amount: input.amount,
          method: input.method,
          status: input.status,
          transactionId: input.transactionId || null,
          notes: input.notes || null,
          paidAt: input.status === "PAID" ? new Date() : null,
          recordedByUserId: session.userId,
        },
        select: { id: true },
      });

      if (input.status === "PAID") {
        const paidPaise =
          toPaise(alreadyPaid) + toPaise(input.amount);
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus:
              paidPaise >= toPaise(order.grandTotal) ? "PAID" : "PENDING",
          },
        });
      }

      return payment.id;
    });

    return this.getById(paymentId);
  },

  async update(
    id: string,
    input: { status: RecordPaymentInput["status"]; transactionId?: string; notes?: string },
    session: AuthSession
  ) {
    const payment = await this.getById(id);

    if (payment.status === input.status) {
      throw new BusinessRuleError(
        `This payment is already marked ${input.status.toLowerCase()}`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: {
          status: input.status,
          transactionId: input.transactionId || payment.transactionId,
          notes: input.notes ?? payment.notes,
          paidAt: input.status === "PAID" ? new Date() : null,
          recordedByUserId: session.userId,
        },
      });

      // Recompute the order's payment status from all its payments.
      const paid = await tx.payment.aggregate({
        where: { orderId: payment.order.id, status: "PAID" },
        _sum: { amount: true },
      });

      const paidPaise = toPaise(Number(paid._sum.amount ?? 0));
      const totalPaise = toPaise(payment.order.grandTotal);

      await tx.order.update({
        where: { id: payment.order.id },
        data: {
          paymentStatus:
            input.status === "REFUNDED"
              ? "REFUNDED"
              : paidPaise >= totalPaise
                ? "PAID"
                : input.status === "FAILED"
                  ? "FAILED"
                  : "PENDING",
        },
      });
    });

    return this.getById(id);
  },
};
