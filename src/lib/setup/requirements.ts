import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { access, statfs, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { projectRoot } from "./state";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  /** What is needed, shown next to the label. */
  requirement: string;
  status: CheckStatus;
  /** What was actually found. */
  detail: string;
  /** How to fix it, shown only when not passing. */
  hint?: string;
}

export interface CheckGroup {
  title: string;
  description: string;
  checks: CheckResult[];
}

export interface RequirementReport {
  groups: CheckGroup[];
  /** True when nothing failed. Warnings do not block setup. */
  ok: boolean;
  passed: number;
  warnings: number;
  failures: number;
  checkedAt: string;
}

/** Next.js 16 refuses to run below this. */
const MIN_NODE = [20, 9, 0];
/** Oldest PostgreSQL this schema is tested against. */
export const MIN_POSTGRES_MAJOR = 13;

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function parseVersion(value: string): number[] {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value);
  if (!match) return [0];
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/** Runs a command purely to read its version banner. Never throws. */
function run(
  command: string,
  args: string[],
  timeoutMs = 4000
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve({ ok: false, output: "" });
      return;
    }

    let output = "";
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok, output: output.trim() });
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(false);
    }, timeoutMs);

    child.stdout?.on("data", (d) => (output += String(d)));
    child.stderr?.on("data", (d) => (output += String(d)));
    child.on("error", () => finish(false));
    child.on("close", (code) => finish(code === 0));
  });
}

/** Reads a dependency's version from node_modules without loading it. */
function packageVersion(name: string): string | null {
  try {
    const file = path.join(projectRoot(), "node_modules", name, "package.json");
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

/** Is anything accepting connections on this host/port? */
function probePort(host: string, port: number, timeoutMs = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkNode(): CheckResult {
  const current = parseVersion(process.versions.node);
  const ok = compareVersions(current, MIN_NODE) >= 0;
  return {
    id: "node",
    label: "Node.js",
    requirement: `${MIN_NODE.join(".")} or newer`,
    status: ok ? "pass" : "fail",
    detail: `v${process.versions.node}`,
    hint: ok
      ? undefined
      : `Next.js 16 will not start on this version. Install Node ${MIN_NODE[0]} LTS or newer, for example with nvm: nvm install ${MIN_NODE[0]}`,
  };
}

async function checkNpm(): Promise<CheckResult> {
  const { ok, output } = await run("npm", ["-v"]);
  return {
    id: "npm",
    label: "npm",
    requirement: "Available on PATH",
    status: ok ? "pass" : "warn",
    detail: ok ? `v${output}` : "Not found",
    hint: ok
      ? undefined
      : "Not needed to finish setup, but you will want it to install updates later.",
  };
}

function checkMemory(): CheckResult {
  const total = os.totalmem();
  const enough = total >= 1024 ** 3;
  return {
    id: "memory",
    label: "System memory",
    requirement: "1 GB or more",
    status: enough ? "pass" : "warn",
    detail: `${formatBytes(total)} total, ${formatBytes(os.freemem())} free · ${os.cpus().length} CPU core(s)`,
    hint: enough
      ? undefined
      : "Builds and image compression may run out of memory on this machine.",
  };
}

async function checkDisk(): Promise<CheckResult> {
  try {
    const stats = await statfs(projectRoot());
    const free = stats.bavail * stats.bsize;
    const status: CheckStatus = free < 256 * 1024 ** 2 ? "fail" : free < 1024 ** 3 ? "warn" : "pass";
    return {
      id: "disk",
      label: "Free disk space",
      requirement: "1 GB recommended",
      status,
      detail: `${formatBytes(free)} available`,
      hint:
        status === "pass"
          ? undefined
          : "Uploaded product images and PostgreSQL both need room to grow.",
    };
  } catch {
    return {
      id: "disk",
      label: "Free disk space",
      requirement: "1 GB recommended",
      status: "warn",
      detail: "Could not be measured on this filesystem",
    };
  }
}

function checkDependencies(): CheckResult {
  const required = ["next", "react", "@prisma/client", "pg", "bcryptjs", "zod"];
  const missing = required.filter((name) => packageVersion(name) === null);
  const nextVersion = packageVersion("next");
  return {
    id: "dependencies",
    label: "Application dependencies",
    requirement: "Installed in node_modules",
    status: missing.length === 0 ? "pass" : "fail",
    detail:
      missing.length === 0
        ? `Next.js ${nextVersion}, Prisma ${packageVersion("@prisma/client")}`
        : `Missing: ${missing.join(", ")}`,
    hint: missing.length === 0 ? undefined : "Run: npm install",
  };
}

function checkPrismaCli(): CheckResult {
  const version = packageVersion("prisma");
  const cli = path.join(projectRoot(), "node_modules", "prisma", "build", "index.js");
  const present = version !== null && existsSync(cli);
  return {
    id: "prisma-cli",
    label: "Prisma CLI",
    requirement: "Needed to create the tables",
    status: present ? "pass" : "fail",
    detail: present ? `v${version}` : "Not installed",
    hint: present
      ? undefined
      : "The Prisma CLI is a devDependency, so `npm install --omit=dev` leaves it out. Run a plain `npm install` to create the tables, or apply prisma/migrations manually.",
  };
}

function checkPrismaClient(): CheckResult {
  const generated = path.join(projectRoot(), "src", "generated", "prisma");
  const present = existsSync(path.join(generated, "client.ts")) || existsSync(path.join(generated, "client.js")) || existsSync(path.join(generated, "index.js"));
  return {
    id: "prisma-client",
    label: "Prisma client",
    requirement: "Generated from the schema",
    status: present ? "pass" : "fail",
    detail: present ? "Generated" : "Not generated",
    hint: present ? undefined : "Run: npm run db:generate",
  };
}

function checkMigrations(): CheckResult {
  const dir = path.join(projectRoot(), "prisma", "migrations");
  let count = 0;
  try {
    count = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch {
    count = 0;
  }
  return {
    id: "migrations",
    label: "Database migrations",
    requirement: "At least one migration present",
    status: count > 0 ? "pass" : "fail",
    detail: count > 0 ? `${count} migration${count === 1 ? "" : "s"} ready to apply` : "None found",
    hint: count > 0 ? undefined : "prisma/migrations is missing — re-download the source.",
  };
}

function checkSharp(): CheckResult {
  const version = packageVersion("sharp");
  return {
    id: "sharp",
    label: "Image compression (sharp)",
    requirement: "Optional but recommended",
    status: version ? "pass" : "warn",
    detail: version ? `v${version}` : "Not installed",
    hint: version
      ? undefined
      : "Product image uploads will fail until this is installed. Run: npm install sharp",
  };
}

async function checkWritable(id: string, label: string, dir: string, create: boolean): Promise<CheckResult> {
  const target = path.join(projectRoot(), dir);
  const shown = dir === "." ? "project folder" : dir;
  try {
    if (create && !existsSync(target)) mkdirSync(target, { recursive: true });
    await access(target, constants.W_OK);
    const probe = path.join(target, `.setup-write-test-${process.pid}`);
    await writeFile(probe, "ok");
    await unlink(probe);
    return {
      id,
      label,
      requirement: "Writable",
      status: "pass",
      detail: `${shown} is writable`,
    };
  } catch (error) {
    return {
      id,
      label,
      requirement: "Writable",
      status: "fail",
      detail: `Cannot write to ${shown}`,
      hint: `Setup needs to write here. ${(error as Error).message}`,
    };
  }
}

async function checkPostgresTools(): Promise<CheckResult> {
  const psql = await run("psql", ["--version"]);
  if (psql.ok) {
    const version = parseVersion(psql.output);
    const supported = version[0] >= MIN_POSTGRES_MAJOR;
    return {
      id: "postgres-client",
      label: "PostgreSQL client tools",
      requirement: `Version ${MIN_POSTGRES_MAJOR} or newer`,
      status: supported ? "pass" : "warn",
      detail: psql.output.replace(/^psql\s*/i, "psql "),
      hint: supported
        ? undefined
        : `These tools are older than PostgreSQL ${MIN_POSTGRES_MAJOR}. The server version is what actually matters and is checked in the next step.`,
    };
  }
  return {
    id: "postgres-client",
    label: "PostgreSQL client tools",
    requirement: `Version ${MIN_POSTGRES_MAJOR} or newer`,
    status: "warn",
    detail: "psql not found on PATH",
    hint: "Not required — the app talks to PostgreSQL over the network. Install postgresql-client if you want a command-line tool for backups.",
  };
}

async function checkPostgresServer(): Promise<CheckResult> {
  const reachable = await probePort("127.0.0.1", 5432);
  return {
    id: "postgres-server",
    label: "PostgreSQL server",
    requirement: "Reachable, locally or remotely",
    status: reachable ? "pass" : "warn",
    detail: reachable
      ? "Listening on localhost:5432"
      : "Nothing listening on localhost:5432",
    hint: reachable
      ? undefined
      : "Fine if your database is on another host — you will enter its address in the next step. For a local server: sudo apt install postgresql && sudo systemctl start postgresql",
  };
}

// ---------------------------------------------------------------------------

export async function runRequirementChecks(): Promise<RequirementReport> {
  const [npm, disk, pgTools, pgServer, rootWritable, uploadsWritable] = await Promise.all([
    checkNpm(),
    checkDisk(),
    checkPostgresTools(),
    checkPostgresServer(),
    checkWritable("writable-root", "Configuration file", ".", false),
    checkWritable("writable-uploads", "Image upload folder", process.env.UPLOAD_DIR || "uploads", true),
  ]);

  const groups: CheckGroup[] = [
    {
      title: "Server runtime",
      description: "The machine this application runs on",
      checks: [checkNode(), npm, checkMemory(), disk],
    },
    {
      title: "Database",
      description: "PostgreSQL stores everything except uploaded images",
      checks: [pgServer, pgTools],
    },
    {
      title: "Application files",
      description: "Downloaded code and installed packages",
      checks: [
        checkDependencies(),
        checkPrismaCli(),
        checkPrismaClient(),
        checkMigrations(),
        checkSharp(),
        rootWritable,
        uploadsWritable,
      ],
    },
  ];

  const all = groups.flatMap((g) => g.checks);
  const failures = all.filter((c) => c.status === "fail").length;
  const warnings = all.filter((c) => c.status === "warn").length;

  return {
    groups,
    ok: failures === 0,
    passed: all.filter((c) => c.status === "pass").length,
    warnings,
    failures,
    checkedAt: new Date().toISOString(),
  };
}
