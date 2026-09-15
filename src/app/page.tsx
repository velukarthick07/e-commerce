import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { TOKEN_COOKIE, verifyToken } from "@/lib/jwt";

/**
 * The front door serves whoever knocks: staff with a live session land on the
 * dashboard, everyone else lands in the shop. Staff who are signed out reach
 * the admin panel through /login as before.
 */
export default async function RootPage() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  redirect(session ? "/dashboard" : "/shop");
}
