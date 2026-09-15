import { handle, ok } from "@/lib/api-response";
import { storefrontService } from "@/services/storefront.service";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handle(async (_request: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  return ok(await storefrontService.product(slug), "Product loaded");
});
