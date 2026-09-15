import { handle, ok } from "@/lib/api-response";
import { clearSessionCookie } from "@/lib/auth";

export const POST = handle(async () => {
  await clearSessionCookie();
  return ok({ loggedOut: true }, "You have been signed out");
});
