import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, SetupRequiredError } from "./errors";
import { serialize } from "./serialize";
import { isSetupComplete } from "./setup/state";

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: object;
}

export interface ApiFailure {
  success: false;
  message: string;
  error: Record<string, unknown>;
}

export function ok<T>(
  data: T,
  message = "Request successful",
  init?: { status?: number; meta?: object }
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = {
    success: true,
    message,
    data: serialize(data),
  };
  if (init?.meta) body.meta = serialize(init.meta);
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function created<T>(data: T, message = "Created successfully") {
  return ok(data, message, { status: 201 });
}

/** Flattens a ZodError into `{ field: [messages] }` for inline form display. */
function zodDetails(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function isPrismaKnownError(
  e: unknown
): e is { code: string; meta?: { target?: string[] | string; modelName?: string } } {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as { code?: unknown }).code === "string" &&
    /^P\d{4}$/.test((e as { code: string }).code)
  );
}

/**
 * Centralised error translation. Every route handler funnels through here so
 * clients always get the documented envelope and never a raw stack trace.
 */
export function fail(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: "Please correct the highlighted fields",
        error: { code: "VALIDATION_ERROR", fields: zodDetails(error) },
      },
      { status: 422 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        error: {
          code: error.code,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode }
    );
  }

  if (isPrismaKnownError(error)) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      const field = Array.isArray(target) ? target.join(", ") : target ?? "value";
      return NextResponse.json(
        {
          success: false,
          message: `A record with this ${field} already exists`,
          error: { code: "CONFLICT", field },
        },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          message: "The requested record no longer exists",
          error: { code: "NOT_FOUND" },
        },
        { status: 404 }
      );
    }
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This record is referenced by other data and cannot be changed",
          error: { code: "FOREIGN_KEY_CONSTRAINT" },
        },
        { status: 409 }
      );
    }
  }

  // Unexpected: log server-side, return a safe message to the client.
  console.error("[api] Unhandled error:", error);
  return NextResponse.json(
    {
      success: false,
      message: "Something went wrong. Please try again.",
      error: { code: "INTERNAL_ERROR" },
    },
    { status: 500 }
  );
}

/**
 * Wraps a route handler so thrown errors become standard failure responses.
 *
 * It also refuses every request until setup has run. The proxy redirects
 * *pages* to the wizard but deliberately skips /api, which must answer with
 * JSON rather than a redirect — so the gate lives here, on the one path all
 * 65 routes share. Without it a half-installed server would answer API calls
 * with connection errors from deep inside Prisma.
 */
export function handle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<Response>
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      if (!isSetupComplete()) throw new SetupRequiredError();
      return await fn(...args);
    } catch (error) {
      return fail(error);
    }
  };
}

/**
 * The same error translation without the setup gate, for the handful of
 * endpoints that exist precisely because setup has not happened yet.
 */
export function handleOpen<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<Response>
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (error) {
      return fail(error);
    }
  };
}
