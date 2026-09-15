import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readEnvFile } from "./setup/env-file";

/**
 * Prisma 7 connects through a driver adapter. `@prisma/adapter-pg` wraps a
 * `pg` Pool, which gives us real connection pooling (sized below).
 *
 * The client is created on first use rather than on import. Before setup has
 * run there is no DATABASE_URL at all, and anything that merely *imports* this
 * module — the proxy's auth helpers, a route file, the setup wizard itself —
 * would otherwise throw before a page could render.
 *
 * A single client is reused across dev hot reloads so repeated module
 * evaluation does not exhaust Postgres connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Next.js reads `.env` into `process.env` once, at boot. The setup wizard
 * writes `.env` while the server is already running, so it also sets
 * `process.env` in that process. The file is read here as a last resort, which
 * covers the case where the code doing the reading is in a different process
 * from the one that ran setup.
 */
function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;

  const fromFile = readEnvFile().DATABASE_URL;
  if (fromFile) {
    process.env.DATABASE_URL = fromFile;
    return fromFile;
  }

  throw new Error(
    "DATABASE_URL is not set. Run the setup wizard at /setup, or copy .env.example to .env and configure it."
  );
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(),
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!client) {
    client = createPrismaClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Drops the cached client so the next query reconnects. Called at the end of
 * setup, when DATABASE_URL has just changed under a running server.
 */
export function resetPrismaClient(): void {
  const previous = client ?? globalForPrisma.prisma;
  client = undefined;
  globalForPrisma.prisma = undefined;
  void previous?.$disconnect().catch(() => undefined);
}

/**
 * Stands in for the real client so `import { prisma }` stays the same
 * everywhere, while construction is deferred to the first property access.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return Reflect.has(getClient(), property);
  },
}) as PrismaClient;

export default prisma;
