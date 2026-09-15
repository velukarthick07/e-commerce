import { BusinessRuleError } from "@/lib/errors";
import { fromPaise, percentOfPaise, toPaise } from "@/lib/money";
import type { DiscountType } from "@/generated/prisma/enums";

export interface PricedLineInput {
  variantId: string;
  productId: string;
  quantity: number;
  mrpPaise: number;
  unitPricePaise: number;
  taxRate: number;
}

export interface CouponRule {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
}

export interface CalculationOptions {
  pricesIncludeTax: boolean;
  taxEnabled: boolean;
  maxManualDiscountPercent: number;
}

export interface CalculatedLine {
  variantId: string;
  productId: string;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CalculatedOrder {
  lines: CalculatedLine[];
  subtotal: number;
  itemDiscount: number;
  couponDiscount: number;
  manualDiscount: number;
  discountTotal: number;
  taxAmount: number;
  deliveryCharge: number;
  grandTotal: number;
  appliedCoupon: { id: string; code: string } | null;
}

/**
 * Computes coupon value against a subtotal, honouring minimum spend and cap.
 * Throws when the coupon cannot apply so the caller can surface the reason.
 */
export function computeCouponDiscountPaise(
  coupon: CouponRule,
  subtotalPaise: number
): number {
  const minPaise = toPaise(coupon.minOrderValue);
  if (subtotalPaise < minPaise) {
    throw new BusinessRuleError(
      `Coupon ${coupon.code} needs a minimum order value of ₹${coupon.minOrderValue}`,
      { code: coupon.code, minOrderValue: coupon.minOrderValue }
    );
  }

  let discount =
    coupon.discountType === "PERCENTAGE"
      ? percentOfPaise(subtotalPaise, coupon.discountValue)
      : toPaise(coupon.discountValue);

  if (coupon.maxDiscount !== null && coupon.maxDiscount !== undefined) {
    discount = Math.min(discount, toPaise(coupon.maxDiscount));
  }

  return Math.max(0, Math.min(discount, subtotalPaise));
}

/**
 * The single source of truth for order money. Runs in integer paise and is
 * used both by the live quote endpoint and by order creation, so the figure
 * the customer is shown is the figure that is charged.
 *
 * Order-level discounts are allocated across lines in proportion to their
 * value, then tax is computed per line at that line's rate.
 */
export function calculateOrder(params: {
  lines: PricedLineInput[];
  coupon?: CouponRule | null;
  manualDiscount: number;
  deliveryCharge: number;
  options: CalculationOptions;
}): CalculatedOrder {
  const { lines, coupon, options } = params;

  if (lines.length === 0) {
    throw new BusinessRuleError("Add at least one product to the order");
  }

  const grossPerLine = lines.map((l) => l.unitPricePaise * l.quantity);
  const subtotalPaise = grossPerLine.reduce((a, b) => a + b, 0);

  const itemDiscountPaise = lines.reduce(
    (sum, l) => sum + Math.max(0, l.mrpPaise - l.unitPricePaise) * l.quantity,
    0
  );

  const couponDiscountPaise = coupon
    ? computeCouponDiscountPaise(coupon, subtotalPaise)
    : 0;

  let manualDiscountPaise = toPaise(params.manualDiscount);
  const manualCapPaise = percentOfPaise(
    subtotalPaise,
    options.maxManualDiscountPercent
  );
  if (manualDiscountPaise > manualCapPaise) {
    throw new BusinessRuleError(
      `Manual discount cannot exceed ${options.maxManualDiscountPercent}% of the subtotal (₹${fromPaise(manualCapPaise)})`,
      { maxDiscount: fromPaise(manualCapPaise) }
    );
  }

  // Total order-level discount can never exceed the subtotal.
  let orderDiscountPaise = couponDiscountPaise + manualDiscountPaise;
  if (orderDiscountPaise > subtotalPaise) {
    orderDiscountPaise = subtotalPaise;
    manualDiscountPaise = Math.max(0, subtotalPaise - couponDiscountPaise);
  }

  // Proportional allocation; the final line absorbs the rounding remainder so
  // the allocated parts always sum exactly to the order discount.
  const allocated: number[] = [];
  let allocatedSoFar = 0;
  grossPerLine.forEach((gross, index) => {
    if (index === grossPerLine.length - 1) {
      allocated.push(orderDiscountPaise - allocatedSoFar);
    } else {
      const share =
        subtotalPaise === 0
          ? 0
          : Math.round((orderDiscountPaise * gross) / subtotalPaise);
      allocated.push(share);
      allocatedSoFar += share;
    }
  });

  let totalTaxPaise = 0;
  let totalLinePaise = 0;

  const calculatedLines: CalculatedLine[] = lines.map((line, index) => {
    const gross = grossPerLine[index];
    const lineDiscount = Math.max(0, Math.min(allocated[index], gross));
    const taxableBase = gross - lineDiscount;

    let taxPaise = 0;
    let lineTotalPaise = taxableBase;

    if (options.taxEnabled && line.taxRate > 0) {
      if (options.pricesIncludeTax) {
        // Price already contains tax: extract it for reporting only.
        taxPaise = Math.round(
          (taxableBase * line.taxRate) / (100 + line.taxRate)
        );
        lineTotalPaise = taxableBase;
      } else {
        taxPaise = percentOfPaise(taxableBase, line.taxRate);
        lineTotalPaise = taxableBase + taxPaise;
      }
    }

    totalTaxPaise += taxPaise;
    totalLinePaise += lineTotalPaise;

    return {
      variantId: line.variantId,
      productId: line.productId,
      quantity: line.quantity,
      mrp: fromPaise(line.mrpPaise),
      unitPrice: fromPaise(line.unitPricePaise),
      discountAmount: fromPaise(lineDiscount),
      taxRate: line.taxRate,
      taxAmount: fromPaise(taxPaise),
      lineTotal: fromPaise(lineTotalPaise),
    };
  });

  const deliveryPaise = toPaise(params.deliveryCharge);
  const grandTotalPaise = totalLinePaise + deliveryPaise;

  return {
    lines: calculatedLines,
    subtotal: fromPaise(subtotalPaise),
    itemDiscount: fromPaise(itemDiscountPaise),
    couponDiscount: fromPaise(couponDiscountPaise),
    manualDiscount: fromPaise(manualDiscountPaise),
    discountTotal: fromPaise(orderDiscountPaise),
    taxAmount: fromPaise(totalTaxPaise),
    deliveryCharge: fromPaise(deliveryPaise),
    grandTotal: fromPaise(grandTotalPaise),
    appliedCoupon: coupon ? { id: coupon.id, code: coupon.code } : null,
  };
}

/** Allowed order status transitions (spec §60). */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export function assertStatusTransition(from: string, to: string): void {
  if (from === to) {
    throw new BusinessRuleError(`Order is already ${to.replace(/_/g, " ").toLowerCase()}`);
  }
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BusinessRuleError(
      `Cannot change status from ${from.replace(/_/g, " ")} to ${to.replace(/_/g, " ")}`,
      { from, to, allowed }
    );
  }
}
