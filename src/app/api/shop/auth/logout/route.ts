import { handle, ok } from "@/lib/api-response";
import { clearCustomerSessionCookie } from "@/lib/customer-auth";

export const POST = handle(async () => {
  await clearCustomerSessionCookie();
  return ok({ loggedOut: true }, "You have been signed out");
});
