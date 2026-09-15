import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resetPrismaClient } from "@/lib/prisma";
import {
  buildDatabaseUrl,
  createDatabaseIfMissing,
  describeDbError,
  inspectServer,
  type DatabaseInput,
} from "./database";
import {
  createFirstAdministrator,
  ensurePermissionsAndRoles,
  ensureStoreSettings,
  type AdministratorInput,
} from "./defaults";
import { applyToProcess, readEnvFile, upsertEnvFile } from "./env-file";
import { clearKey } from "./key";
import { projectRoot, writeLock } from "./state";
import type { InstallEvent, StepId } from "@/types/setup";

export interface InstallInput {
  database: DatabaseInput;
  administrator: AdministratorInput;
  storeName: string;
  /** Origin the browser reached the wizard on, used for APP_URL. */
  appUrl?: string;
}

export const INSTALL_STEPS: { id: StepId; label: string }[] = [
  { id: "connect", label: "Checking the database server" },
  { id: "database", label: "Creating the database" },
  { id: "schema", label: "Creating tables" },
  { id: "defaults", label: "Loading roles, permissions and store settings" },
  { id: "administrator", label: "Creating the administrator account" },
  { id: "configure", label: "Writing configuration" },
];

type Emit = (event: InstallEvent) => void;

/** Runs `prisma migrate deploy` against the new database. */
function applyMigrations(databaseUrl: string, emit: Emit): Promise<void> {
  const cli = path.join(projectRoot(), "node_modules", "prisma", "build", "index.js");
  if (!existsSync(cli)) {
    return Promise.reject(
      new Error(
        "The Prisma CLI is not installed, so the tables cannot be created. Run `npm install` (without --omit=dev) and try again."
      )
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cli, "migrate", "deploy", "--schema", path.join("prisma", "schema.prisma")],
      {
        cwd: projectRoot(),
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          PRISMA_HIDE_UPDATE_MESSAGE: "1",
          NO_COLOR: "1",
          CI: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let tail = "";
    const forward = (chunk: unknown) => {
      const text = String(chunk);
      tail = `${tail}${text}`.slice(-4000);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) emit({ kind: "log", line: line.trim() });
      }
    };

    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    child.on("error", reject);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Creating the tables took longer than two minutes and was stopped."));
    }, 120_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(tail.trim() || `prisma migrate deploy exited with code ${code}`));
    });
  });
}

/** A client bound to the database we have just built, not the global one. */
function clientFor(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, max: 5 }),
    log: ["error"],
  });
}

function appVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(projectRoot(), "package.json"), "utf8")
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Carries which step failed so the wizard can highlight it. */
export class StepError extends Error {
  readonly stepId: StepId;
  constructor(stepId: StepId, message: string) {
    super(message);
    this.name = "StepError";
    this.stepId = stepId;
  }
}

/**
 * Performs the installation, reporting progress as it goes.
 *
 * The order matters. `.env` is written last, after every step that can fail,
 * for two reasons: a half-configured file is worse than none, and in
 * development Next.js restarts the server when `.env` changes — which would
 * kill this very request if it happened in the middle.
 */
export async function runInstall(input: InstallInput, emit: Emit): Promise<void> {
  const databaseUrl = buildDatabaseUrl(input.database);
  const step = (id: StepId, label: string) => emit({ kind: "step", id, label, status: "running" });
  const done = (id: StepId, detail: string) => emit({ kind: "step", id, status: "done", detail });

  // 1. Connect ------------------------------------------------------------
  step("connect", INSTALL_STEPS[0].label);
  let report;
  try {
    report = await inspectServer(input.database);
  } catch (error) {
    throw new StepError("connect", describeDbError(error));
  }
  if (!report.canProceed) throw new StepError("connect", report.message);
  done("connect", `PostgreSQL ${report.serverVersion}, connected as ${report.currentUser}`);

  // 2. Create the database ------------------------------------------------
  step("database", INSTALL_STEPS[1].label);
  let createdDatabase = false;
  try {
    createdDatabase = await createDatabaseIfMissing(input.database);
  } catch (error) {
    throw new StepError("database", describeDbError(error));
  }
  done(
    "database",
    createdDatabase
      ? `Created "${input.database.database}"`
      : `Using the existing "${input.database.database}"`
  );

  // 3. Tables -------------------------------------------------------------
  step("schema", INSTALL_STEPS[2].label);
  try {
    await applyMigrations(databaseUrl, emit);
  } catch (error) {
    throw new StepError("schema", (error as Error).message);
  }
  done("schema", "All migrations applied");

  // 4 & 5. Default rows and the administrator -----------------------------
  const db = clientFor(databaseUrl);
  let adminEmail = input.administrator.email.trim().toLowerCase();
  try {
    step("defaults", INSTALL_STEPS[3].label);
    let roleIds;
    try {
      roleIds = await ensurePermissionsAndRoles(db);
      await ensureStoreSettings(db, { storeName: input.storeName });
    } catch (error) {
      throw new StepError("defaults", (error as Error).message);
    }
    done("defaults", `${roleIds.size} roles and their permissions, plus store settings`);

    step("administrator", INSTALL_STEPS[4].label);
    try {
      const admin = await createFirstAdministrator(db, input.administrator, roleIds);
      adminEmail = admin.email;
    } catch (error) {
      throw new StepError("administrator", (error as Error).message);
    }
    done("administrator", `${adminEmail} can sign in as Super Admin`);
  } finally {
    await db.$disconnect().catch(() => undefined);
  }

  // 6. Configuration ------------------------------------------------------
  step("configure", INSTALL_STEPS[5].label);
  const current = { ...readEnvFile(), ...process.env } as Record<string, string>;

  const updates: Record<string, string> = { DATABASE_URL: databaseUrl };
  const fillIfMissing = (key: string, value: string) => {
    if (!current[key]) updates[key] = value;
  };

  fillIfMissing("JWT_SECRET", randomBytes(32).toString("hex"));
  fillIfMissing("JWT_EXPIRES_IN", "7d");
  fillIfMissing("CUSTOMER_JWT_EXPIRES_IN", "30d");
  fillIfMissing("UPLOAD_DIR", "uploads");
  fillIfMissing("MAX_UPLOAD_SIZE_MB", "5");
  fillIfMissing("IMAGE_MAX_DIMENSION", "1600");
  fillIfMissing("IMAGE_QUALITY", "82");
  fillIfMissing("OTP_ECHO", "true");
  fillIfMissing("STOREFRONT_OPEN_AUTOFILL", "false");
  if (input.appUrl) {
    fillIfMissing("APP_URL", input.appUrl);
    fillIfMissing("CLIENT_URL", input.appUrl);
  }

  try {
    // Same opt-out as lib/upload-storage.ts: the folder is configurable, so
    // tracing it would pull the entire project into the build output.
    const uploads = path.join(
      /* turbopackIgnore: true */ projectRoot(),
      updates.UPLOAD_DIR ?? current.UPLOAD_DIR ?? "uploads"
    );
    if (!existsSync(uploads)) mkdirSync(uploads, { recursive: true });

    // The running process first, so the app works without a restart.
    applyToProcess(updates);
    resetPrismaClient();
    upsertEnvFile(updates);

    writeLock({
      completedAt: new Date().toISOString(),
      database: `${input.database.host}:${input.database.port}/${input.database.database}`,
      adminEmail,
      version: appVersion(),
    });
    clearKey();
  } catch (error) {
    throw new StepError("configure", (error as Error).message);
  }
  done("configure", "Saved to .env — setup is now closed");

  emit({ kind: "done", adminEmail, database: input.database.database });
}

