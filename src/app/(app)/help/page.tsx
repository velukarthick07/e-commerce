import type { Metadata } from "next";
import { UserManual } from "@/components/help/UserManual";

export const metadata: Metadata = {
  title: "User manual",
  description:
    "How to use the admin panel and counter: orders, stock, batches, expiry, customers, reports and the customer website.",
};

export default function HelpPage() {
  return <UserManual />;
}
