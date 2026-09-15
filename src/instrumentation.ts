/**
 * Runs once per server start, before the first request is served.
 *
 * Two jobs, both about the setup wizard:
 *
 *  1. Adopt an installation that predates the wizard. An upgrade drops this
 *     code into a store that is already running, with a database full of real
 *     orders and no lock file. Without this, every visitor would be redirected
 *     into a wizard offering to install over the top of them.
 *
 *  2. Otherwise, mint the setup key and print how to finish installing.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isSetupComplete, writeLock } = await import("./lib/setup/state");
  if (isSetupComplete()) return;

  const adopted = await adoptExistingInstallation(writeLock);
  if (adopted) return;

  const { ensureKey, keyRequired } = await import("./lib/setup/key");
  const port = process.env.PORT || "3000";
  const url = process.env.APP_URL || `http://localhost:${port}`;

  const lines = [
    "",
    "  ┌──────────────────────────────────────────────────────────────┐",
    "  │  This installation has not been set up yet.                  │",
    "  └──────────────────────────────────────────────────────────────┘",
    "",
    `  Finish installing at:  ${url}/setup`,
  ];

  if (keyRequired()) {
    lines.push(
      "",
      `  Setup key:             ${ensureKey()}`,
      "",
      "  The wizard asks for that key before it will touch the database,",
      "  so that only someone with access to this server can create the",
      "  first administrator. It is also saved in .setup-key, and is",
      "  deleted once setup finishes.",
      "",
      "  Set SETUP_REQUIRE_KEY=false to skip it on a private machine."
    );
  }

  lines.push("");
  console.log(lines.join("\n"));
}

/**
 * Is there already a working installation behind this DATABASE_URL?
 *
 * Deliberately uses `pg` rather than Prisma: this runs at boot on a server
 * that may be mid-upgrade, and a missing table must look like "not installed"
 * rather than crash the process.
 */
async function adoptExistingInstallation(
  writeLock: (lock: {
    completedAt: string;
    database: string;
    adminEmail: string;
    version: string;
  }) => void
): Promise<boolean> {
  const { readEnvFile } = await import("./lib/setup/env-file");
  const connectionString = process.env.DATABASE_URL || readEnvFile().DATABASE_URL;
  if (!connectionString) return false;

  const { Client } = await import("pg");
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
    const exists = await client.query<{ reg: string | null }>(
      "SELECT to_regclass('public.users')::text AS reg"
    );
    if (!exists.rows[0]?.reg) return false;

    const admin = await client.query<{ email: string }>(
      "SELECT email FROM public.users ORDER BY id LIMIT 1"
    );
    if (admin.rowCount === 0) return false;

    let database = "existing database";
    try {
      database = new URL(connectionString).pathname.replace(/^\//, "") || database;
    } catch {
      // A connection string we cannot parse still tells us nothing is wrong.
    }

    writeLock({
      completedAt: new Date().toISOString(),
      database,
      adminEmail: admin.rows[0].email,
      version: "adopted",
    });

    console.log(
      `[setup] Existing installation detected (${database}); the setup wizard is disabled.`
    );
    return true;
  } catch {
    // Unreachable or unreadable: fall through and offer setup.
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}
