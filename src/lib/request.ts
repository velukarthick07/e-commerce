import type { NextRequest } from "next/server";
import type { z } from "zod";
import { BadRequestError } from "./errors";

/** Validates `?a=1&b=2` against a Zod schema (throws ZodError on failure). */
export function parseQuery<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): z.infer<S> {
  const raw: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  return schema.parse(raw);
}

/** Validates a JSON request body against a Zod schema. */
export async function parseBody<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function boolFromQuery(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true";
}
