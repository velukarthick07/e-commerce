import { couponRepository } from "@/repositories/coupon.repository";
import { BusinessRuleError, ConflictError } from "@/lib/errors";
import { assertFound } from "@/lib/utils";
import { toPaise, fromPaise } from "@/lib/money";
import { computeCouponDiscountPaise } from "./order-calculation";
import type { CreateCouponInput } from "@/validators/coupon.validator";

export const couponService = {
  list: couponRepository.list,

  async getById(id: string) {
    return assertFound(await couponRepository.findById(id), "Coupon");
  },

  async create(input: CreateCouponInput) {
    if (await couponRepository.codeExists(input.code)) {
      throw new ConflictError(`Coupon code ${input.code} is already in use`);
    }

    return couponRepository.create({
      code: input.code,
      description: input.description || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderValue: input.minOrderValue,
      maxDiscount: input.maxDiscount ?? null,
      usageLimit: input.usageLimit,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: input.isActive,
    });
  },

  async update(id: string, input: CreateCouponInput) {
    const existing = await this.getById(id);

    if (await couponRepository.codeExists(input.code, id)) {
      throw new ConflictError(`Coupon code ${input.code} is already in use`);
    }
    if (input.usageLimit !== null && input.usageLimit < existing.usedCount) {
      throw new BusinessRuleError(
        `This coupon has already been used ${existing.usedCount} times, so the limit cannot be lower`
      );
    }

    return couponRepository.update(id, {
      code: input.code,
      description: input.description || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderValue: input.minOrderValue,
      maxDiscount: input.maxDiscount ?? null,
      usageLimit: input.usageLimit,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      isActive: input.isActive,
    });
  },

  async remove(id: string) {
    const coupon = await this.getById(id);
    if (coupon._count.orders > 0) {
      throw new BusinessRuleError(
        `This coupon is attached to ${coupon._count.orders} order${coupon._count.orders === 1 ? "" : "s"}. Deactivate it instead.`
      );
    }
    await couponRepository.delete(id);
    return { id };
  },

  /** Validates a code against a subtotal and returns the resulting discount. */
  async validate(code: string, subtotal: number) {
    const coupon = await couponRepository.findByCode(code.trim().toUpperCase());
    if (!coupon) throw new BusinessRuleError(`Coupon ${code} does not exist`);
    if (!coupon.isActive) throw new BusinessRuleError(`Coupon ${coupon.code} is inactive`);

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BusinessRuleError(`Coupon ${coupon.code} is not active yet`);
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BusinessRuleError(`Coupon ${coupon.code} has expired`);
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BusinessRuleError(`Coupon ${coupon.code} has reached its usage limit`);
    }

    const discountPaise = computeCouponDiscountPaise(
      {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        minOrderValue: Number(coupon.minOrderValue),
        maxDiscount: coupon.maxDiscount === null ? null : Number(coupon.maxDiscount),
      },
      toPaise(subtotal)
    );

    return {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discount: fromPaise(discountPaise),
      description: coupon.description,
    };
  },
};
