import { Client, type ClientConfig } from "pg";
import { MIN_POSTGRES_MAJOR } from "./requirements";

export interface DatabaseInput {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** Connect over TLS. Managed providers generally require this. */
  ssl: boolean;
}

/**
 * What we found in the target database, and therefore what setup may do.
 *
 * `installed` is the important one: it means somebody has already run setup
 * against this database, and continuing would be a second installation over
 * the top of live data.
 */
export type TargetState = "missing" | "empty" | "has-schema" | "installed" | "foreign";

export interface ServerReport {
  serverVersion: string;
  serverMajor: number;
  versionSupported: boolean;
  currentUser: string;
  canCreateDatabase: boolean;
  isSuperuser: boolean;
  target: TargetState;
  /** Tables already present in the target database's public schema. */
  tableCount: number;
  userCount: number;
  /** True when setup is allowed to continue. */
  canProceed: boolean;
  message: string;
}

/** PostgreSQL identifiers cannot be parameterised, so they are validated. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function isValidDatabaseName(name: string): boolean {
  return IDENTIFIER.test(name) && Buffer.byteLength(name) <= 63;
}

/** Double-quote an identifier that has already been validated. */
function quoteIdentifier(name: string): string {
  if (!isValidDatabaseName(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function clientConfig(input: DatabaseInput, database: string): ClientConfig {
  return {
    host: input.host,
    port: input.port,
    user: input.user,
    password: input.password,
    database,
    // Managed PostgreSQL almost always presents a certificate signed by a CA
    // the server does not have. Verification is therefore off; the connection
    // is still encrypted.
    ssl: input.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
    application_name: "fmcg-setup",
  };
}

/** Turns a driver error into something an operator can act on. */
export function describeDbError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  switch (e?.code) {
    case "ECONNREFUSED":
      return "Nothing is accepting connections at that address. Check the host and port, and that PostgreSQL is running.";
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "That host name could not be resolved. Check the spelling, or use an IP address.";
    case "ETIMEDOUT":
      return "The connection timed out. A firewall may be blocking the port.";
    case "28P01":
      return "The password was not accepted for that user.";
    case "28000":
      return "That user is not allowed to connect from this machine. Check the server's pg_hba.conf.";
    case "3D000":
      return "That database does not exist and could not be created.";
    case "42501":
      return "That user does not have permission to do this.";
    case "53300":
      return "The server has too many connections open already.";
    default:
      return e?.message || "Could not connect to PostgreSQL.";
  }
}

async function withClient<T>(
  config: ClientConfig,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client(config);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Connects to a database we know exists so we can ask the server about itself.
 * `postgres` is the conventional one; `template1` always exists as a fallback.
 */
async function connectMaintenance<T>(
  input: DatabaseInput,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const candidates = ["postgres", "template1", input.database];
  let lastError: unknown;
  for (const database of candidates) {
    try {
      return await withClient(clientConfig(input, database), fn);
    } catch (error) {
      lastError = error;
      // Only keep trying when the database itself was the problem.
      if ((error as { code?: string }).code !== "3D000") throw error;
    }
  }
  throw lastError;
}

/** Reads the state of the target database without changing anything. */
export async function inspectServer(input: DatabaseInput): Promise<ServerReport> {
  const base = await connectMaintenance(input, async (client) => {
    const version = await client.query<{ full: string; num: string }>(
      "SELECT version() AS full, current_setting('server_version_num') AS num"
    );
    const role = await client.query<{
      current_user: string;
      rolcreatedb: boolean;
      rolsuper: boolean;
    }>(
      `SELECT current_user,
              COALESCE(rolcreatedb, false) AS rolcreatedb,
              COALESCE(rolsuper, false)    AS rolsuper
         FROM pg_roles WHERE rolname = current_user`
    );
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [input.database]
    );

    const versionNum = Number(version.rows[0]?.num ?? 0);
    return {
      serverVersion: /PostgreSQL ([\d.]+)/.exec(version.rows[0]?.full ?? "")?.[1] ?? "unknown",
      serverMajor: Math.floor(versionNum / 10000),
      currentUser: role.rows[0]?.current_user ?? input.user,
      canCreateDatabase: role.rows[0]?.rolcreatedb ?? false,
      isSuperuser: role.rows[0]?.rolsuper ?? false,
      databaseExists: (exists.rowCount ?? 0) > 0,
    };
  });

  let target: TargetState = "missing";
  let tableCount = 0;
  let userCount = 0;

  if (base.databaseExists) {
    const inspection = await withClient(
      clientConfig(input, input.database),
      async (client) => {
        const tables = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count
             FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );
        const usersTable = await client.query<{ reg: string | null }>(
          "SELECT to_regclass('public.users')::text AS reg"
        );
        let users = 0;
        if (usersTable.rows[0]?.reg) {
          const count = await client.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM public.users"
          );
          users = Number(count.rows[0]?.count ?? 0);
        }
        return {
          tables: Number(tables.rows[0]?.count ?? 0),
          hasUsersTable: Boolean(usersTable.rows[0]?.reg),
          users,
        };
      }
    );

    tableCount = inspection.tables;
    userCount = inspection.users;

    if (inspection.users > 0) target = "installed";
    else if (inspection.hasUsersTable) target = "has-schema";
    else if (inspection.tables === 0) target = "empty";
    else target = "foreign";
  }

  const versionSupported = base.serverMajor >= MIN_POSTGRES_MAJOR;

  let canProceed = true;
  let message = "";

  if (!versionSupported) {
    canProceed = false;
    message = `PostgreSQL ${base.serverVersion} is older than the minimum supported version (${MIN_POSTGRES_MAJOR}).`;
  } else if (target === "installed") {
    canProceed = false;
    message = `"${input.database}" already contains an installation with ${userCount} user account${userCount === 1 ? "" : "s"}. Point setup at a different database, or sign in to the existing one.`;
  } else if (target === "foreign") {
    canProceed = false;
    message = `"${input.database}" already contains ${tableCount} table${tableCount === 1 ? "" : "s"} belonging to something else. Choose an empty database so nothing is overwritten.`;
  } else if (target === "missing" && !base.canCreateDatabase && !base.isSuperuser) {
    canProceed = false;
    message = `"${input.database}" does not exist and ${base.currentUser} is not allowed to create databases. Either grant it with ALTER ROLE ${base.currentUser} CREATEDB, or create the database by hand and run setup again.`;
  } else if (target === "missing") {
    message = `Connected to PostgreSQL ${base.serverVersion}. "${input.database}" will be created.`;
  } else if (target === "has-schema") {
    message = `Connected to PostgreSQL ${base.serverVersion}. "${input.database}" already has the tables but no accounts — setup will finish the installation.`;
  } else {
    message = `Connected to PostgreSQL ${base.serverVersion}. "${input.database}" exists and is empty.`;
  }

  return {
    serverVersion: base.serverVersion,
    serverMajor: base.serverMajor,
    versionSupported,
    currentUser: base.currentUser,
    canCreateDatabase: base.canCreateDatabase || base.isSuperuser,
    isSuperuser: base.isSuperuser,
    target,
    tableCount,
    userCount,
    canProceed,
    message,
  };
}

/** Creates the database if it is not already there. Returns true if created. */
export async function createDatabaseIfMissing(input: DatabaseInput): Promise<boolean> {
  return connectMaintenance(input, async (client) => {
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [input.database]
    );
    if ((exists.rowCount ?? 0) > 0) return false;

    await client.query(
      `CREATE DATABASE ${quoteIdentifier(input.database)} ENCODING 'UTF8' TEMPLATE template0`
    );
    return true;
  });
}

/** The connection string written to .env and handed to Prisma. */
export function buildDatabaseUrl(input: DatabaseInput): string {
  const host = input.host.includes(":") ? `[${input.host}]` : input.host;
  const auth = `${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}`;
  const params = new URLSearchParams({
    schema: "public",
    connection_limit: "10",
    pool_timeout: "20",
  });
  if (input.ssl) params.set("sslmode", "require");
  return `postgresql://${auth}@${host}:${input.port}/${encodeURIComponent(input.database)}?${params.toString()}`;
}
