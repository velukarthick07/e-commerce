import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup/state";
import { SetupWizard } from "@/components/setup/SetupWizard";

/**
 * Nothing here may be prerendered: whether this page exists at all depends on
 * a file on disk that is written while the server is running.
 */
export const dynamic = "force-dynamic";

/**
 * The proxy already redirects away from /setup once installation is finished.
 * This repeats the check because the consequence of getting it wrong — an
 * open, unauthenticated "create an administrator" form on a live store — is
 * severe enough to be worth checking in both places.
 */
export default function SetupPage() {
  if (isSetupComplete()) redirect("/login");
  return <SetupWizard />;
}
