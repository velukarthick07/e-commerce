import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./state";

/**
 * Reading and rewriting `.env`.
 *
 * Next.js reads `.env` once, at boot, into `process.env`. A file written
 * afterwards is invisible to the process that wrote it, which matters here:
 * setup writes the database credentials into a server that is already
 * running. So every write also updates `process.env` in place, and readers
 * that run before any `.env` existed fall back to parsing the file directly.
 */
export function envPath(): string {
  return path.join(projectRoot(), ".env");
}

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

/** Unwraps quotes and resolves the escapes dotenv understands. */
function parseValue(raw: string): string {
  let value = raw.trim();

  // Strip a trailing unquoted comment: FOO=bar # note
  if (!value.startsWith('"') && !value.startsWith("'")) {
    const hash = value.indexOf(" #");
    if (hash !== -1) value = value.slice(0, hash).trim();
    return value;
  }

  const quote = value[0];
  const end = value.lastIndexOf(quote);
  if (end <= 0) return value;
  value = value.slice(1, end);

  // Only double quotes interpolate escapes, matching dotenv.
  if (quote === '"') {
    value = value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return value;
}

/** Parses `.env` text into a plain object. Unknown syntax is skipped. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = LINE.exec(line);
    if (!match) continue;
    out[match[1]] = parseValue(match[2]);
  }
  return out;
}

/** Reads `.env` straight from disk, bypassing `process.env`. */
export function readEnvFile(): Record<string, string> {
  try {
    return parseEnv(readFileSync(envPath(), "utf8"));
  } catch {
    return {};
  }
}

function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

/**
 * Writes the given keys into `.env`, replacing existing assignments in place
 * and appending the rest. Comments, ordering and unrelated keys survive, so an
 * operator's hand-tuned file is not flattened by re-running setup.
 */
export function upsertEnvFile(updates: Record<string, string>): void {
  const file = envPath();
  const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
  const lines = existing ? existing.split(/\r?\n/) : [];
  const pending = new Map(Object.entries(updates));

  const rewritten = lines.map((line) => {
    const match = LINE.exec(line);
    if (!match) return line;
    const key = match[1];
    if (!pending.has(key)) return line;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${quote(value)}`;
  });

  if (pending.size > 0) {
    if (rewritten.length && rewritten[rewritten.length - 1].trim() !== "") {
      rewritten.push("");
    }
    rewritten.push("# ---- Written by the setup wizard ----");
    for (const [key, value] of pending) {
      rewritten.push(`${key}=${quote(value)}`);
    }
  }

  let text = rewritten.join("\n");
  if (!text.endsWith("\n")) text += "\n";
  writeFileSync(file, text, "utf8");

  // Holds the database password and the JWT signing secret.
  try {
    chmodSync(file, 0o600);
  } catch {
    // Windows and some mounted filesystems do not support this; not fatal.
  }
}

/** Makes the new values visible to the process that is already running. */
export function applyToProcess(updates: Record<string, string>): void {
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }
}
