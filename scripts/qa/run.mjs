/**
 * Full QA pass: every role against every module, over the real HTTP API and a
 * real database.
 *
 *   node scripts/qa/run.mjs            # against http://localhost:3117
 *   QA_BASE_URL=http://localhost:3000 node scripts/qa/run.mjs
 *
 * Two things happen here. First an exhaustive authorisation sweep: every route
 * handler is discovered by scanning the source, the permission it demands is
 * read out of the code, and each role is checked against it — so the matrix can
 * never drift from what the handlers actually enforce. Then a functional pass
 * that exercises each module end to end and *leaves its data behind*, so the
 * database ends up holding a worked example of every scenario the app supports.
 *
 * Re-running is safe: every run tags its own data with a fresh id.
 */
import { readFileSync } from "node:fs";
import { staffLogin } from "./client.mjs";
import { Report } from "./report.mjs";
import { runRbacMatrix } from "./rbac.mjs";
import {
  authScenarios, categoryScenarios, customerScenarios,
  inventoryScenarios, productScenarios, userScenarios,
} from "./scenarios-core.mjs";
import {
  closingStateScenarios, couponScenarios, localOrderScenarios,
  orderLifecycleScenarios, paymentScenarios, reportScenarios, settingsScenarios,
} from "./scenarios-commerce.mjs";
import { storefrontScenarios } from "./scenarios-shop.mjs";
import { uploadScenarios } from "./scenarios-uploads.mjs";
import { setupScenarios } from "./scenarios-setup.mjs";

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3117";

function readEnv(file = ".env") {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index < 0) continue;
      out[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fall through to the documented defaults
  }
  return out;
}

async function main() {
  const env = readEnv();
  const accounts = {
    superAdmin: { email: env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@fmcg.local", password: env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123" },
    admin: { email: env.SEED_ADMIN_EMAIL ?? "admin@fmcg.local", password: env.SEED_ADMIN_PASSWORD ?? "Admin@123" },
    manager: { email: env.SEED_MANAGER_EMAIL ?? "manager@fmcg.local", password: env.SEED_MANAGER_PASSWORD ?? "Manager@123" },
    staff: { email: env.SEED_STAFF_EMAIL ?? "staff@fmcg.local", password: env.SEED_STAFF_PASSWORD ?? "Staff@123" },
  };

  const health = await fetch(`${BASE_URL}/api/shop/store`).catch(() => null);
  if (!health?.ok) {
    console.error(`Cannot reach the app at ${BASE_URL}. Start it first (npm start / npm run dev).`);
    process.exit(1);
  }

  const seed = Math.floor(Math.random() * 9_000_000) + 1_000_000; // 7 digits
  const runId = seed.toString(36).toUpperCase().slice(-4);
  const report = new Report();

  console.log("=".repeat(78));
  console.log(`QA PASS — ${BASE_URL}`);
  console.log(`run id ${runId} · ${new Date().toLocaleString("en-IN")}`);
  console.log("=".repeat(78));

  console.log("\nSigning in as each role…");
  const superAdmin = await staffLogin(BASE_URL, accounts.superAdmin.email, accounts.superAdmin.password, "super");
  const admin = await staffLogin(BASE_URL, accounts.admin.email, accounts.admin.password, "admin");
  const manager = await staffLogin(BASE_URL, accounts.manager.email, accounts.manager.password, "manager");
  const staff = await staffLogin(BASE_URL, accounts.staff.email, accounts.staff.password, "staff");
  for (const client of [superAdmin, admin, manager, staff]) {
    console.log(`  ${client.role.padEnd(12)} ${client.name.padEnd(22)} ${client.permissions.length} permissions`);
    report.check("Auth", `${client.role} can sign in`, true);
  }

  const ctx = {
    baseUrl: BASE_URL, report, runId, accounts,
    superAdmin, admin, manager, staff,
    created: {},
    /** Unique, well-formed 10-digit mobile numbers for this run. */
    phone: (n) => `9${String(seed).padStart(7, "0")}${String(n).padStart(2, "0")}`,
  };

  console.log("\nSweeping every endpoint against every role…");
  const endpointCount = await runRbacMatrix(BASE_URL, [superAdmin, admin, manager, staff], report);
  console.log(`  ${endpointCount} endpoints × 5 callers (anonymous + 4 roles)`);

  const phases = [
    ["Auth", authScenarios],
    ["Users", userScenarios],
    ["Categories", categoryScenarios],
    ["Products", productScenarios],
    ["Image uploads", uploadScenarios],
    ["Inventory", inventoryScenarios],
    ["Customers", customerScenarios],
    ["Coupons", couponScenarios],
    ["Local orders", localOrderScenarios],
    ["Storefront", storefrontScenarios],
    ["Payments", paymentScenarios],
    ["Order lifecycle", orderLifecycleScenarios],
    ["Reports", reportScenarios],
    ["Settings", settingsScenarios],
    ["Setup wizard", setupScenarios],
    ["Closing state", closingStateScenarios],
  ];

  console.log("\nRunning module scenarios…");
  for (const [name, fn] of phases) {
    process.stdout.write(`  ${name.padEnd(18)}`);
    const before = report.rows.length;
    try {
      await fn(ctx);
      const failed = report.rows.slice(before).filter((r) => !r.passed).length;
      console.log(`${report.rows.length - before} checks${failed ? `, ${failed} failed` : ""}`);
    } catch (error) {
      report.check(name, "the scenario ran to completion", false, `threw: ${error.message}`);
      console.log(`ERROR — ${error.message}`);
    }
  }

  const green = report.print();
  console.log(`\nRun id ${runId} — search for it in the admin to find everything this pass created.`);
  process.exit(green ? 0 : 1);
}

main().catch((error) => {
  console.error("QA run failed to start:", error);
  process.exit(1);
});
