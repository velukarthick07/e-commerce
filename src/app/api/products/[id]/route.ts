import type { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api-response";
import { parseBody } from "@/lib/request";
import { requirePermission } from "@/lib/auth";
import { createProductSchema } from "@/validators/product.validator";
import { productService } from "@/services/product.service";
import { BadRequestError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("products:read", request);
  const { id } = await ctx.params;
  return ok(await productService.getById(id), "Product loaded");
});

export const PUT = handle(async (request: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("products:update", request);
  const { id } = await ctx.params;
  const input = await parseBody(request, createProductSchema);
  return ok(await productService.update(id, input, session), "Product updated successfully");
});

/**
 * Activation toggle only — a full edit goes through PUT with the whole product.
 *
 * Anything other than `isActive` is rejected rather than quietly ignored: a
 * silent 200 on `{ sellingPrice: 289 }` would leave the caller believing the
 * price had changed.
 */
export const PATCH = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("products:update", request);
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body must be valid JSON");
  }

  const unexpected = Object.keys(body).filter((key) => key !== "isActive");
  if (unexpected.length > 0) {
    throw new BadRequestError(
      `PATCH only changes a product's activation. Use PUT to edit ${unexpected.join(", ")}.`,
      { unexpected }
    );
  }

  if (typeof body.isActive !== "boolean") {
    throw new BadRequestError("isActive must be true or false");
  }

  return ok(
    await productService.setActive(id, body.isActive),
    body.isActive ? "Product activated" : "Product deactivated"
  );
});

export const DELETE = handle(async (request: NextRequest, ctx: Ctx) => {
  await requirePermission("products:delete", request);
  const { id } = await ctx.params;
  return ok(await productService.remove(id), "Product deleted successfully");
});
