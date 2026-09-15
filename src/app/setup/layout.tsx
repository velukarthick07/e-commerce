import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Setup · FMCG Admin" },
  description: "First-time installation for the FMCG admin panel and storefront.",
  robots: { index: false, follow: false },
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
