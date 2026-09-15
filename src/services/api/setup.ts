"use client";

import type {
  InstallEvent,
  RequirementReport,
  ServerReport,
  SetupStatus,
} from "@/types/setup";

/**
 * The setup wizard talks to the server with plain `fetch` rather than the
 * shared axios client. That client redirects to /login on any 401 — which,
 * while the app is uninstalled, the proxy would immediately redirect back to
 * /setup. A mistyped setup key would become an endless loop instead of an
 * error message.
 */

export class SetupError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string[]>;
  constructor(message: string, status: number, fields?: Record<string, string[]>) {
    super(message);
    this.name = "SetupError";
    this.status = status;
    this.fields = fields;
  }
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  error?: { code?: string; fields?: Record<string, string[]> };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new SetupError("Cannot reach the server. Is it still running?", 0);
  }

  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.success) {
    throw new SetupError(
      body?.message ?? `The server returned ${response.status}.`,
      response.status,
      body?.error?.fields
    );
  }
  return body.data;
}

export function fetchStatus(): Promise<SetupStatus> {
  return request<SetupStatus>("/api/setup/status", { cache: "no-store" });
}

export function fetchRequirements(): Promise<RequirementReport> {
  return request<RequirementReport>("/api/setup/requirements", { cache: "no-store" });
}

export function testDatabase(payload: unknown): Promise<ServerReport> {
  return request<ServerReport>("/api/setup/database", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Runs the installer, invoking `onEvent` for each newline-delimited JSON
 * message as it arrives.
 *
 * Errors raised before the stream opens (validation, a bad setup key) come
 * back as an ordinary JSON envelope, so both shapes are handled.
 */
export async function runInstall(
  payload: unknown,
  onEvent: (event: InstallEvent) => void
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/setup/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new SetupError("Cannot reach the server. Is it still running?", 0);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("ndjson")) {
    let body: Envelope<unknown> | null = null;
    try {
      body = (await response.json()) as Envelope<unknown>;
    } catch {
      body = null;
    }
    throw new SetupError(
      body?.message ?? `The server returned ${response.status}.`,
      response.status,
      body?.error?.fields
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new SetupError("The server sent an empty response.", 500);

  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as InstallEvent);
        } catch {
          // A partial or malformed line is not worth failing the install over.
        }
      }
      newline = buffer.indexOf("\n");
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    flush(decoder.decode(value, { stream: true }));
  }
  flush(decoder.decode());
}
