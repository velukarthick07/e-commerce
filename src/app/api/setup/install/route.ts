import { handleOpen } from "@/lib/api-response";
import { assertSetupKey, assertSetupOpen } from "@/lib/setup/guard";
import { runInstall, StepError } from "@/lib/setup/provision";
import { installSchema } from "@/validators/setup.validator";
import type { InstallEvent } from "@/types/setup";

/** Streamed, and it shells out to the Prisma CLI — never prerender this. */
export const dynamic = "force-dynamic";

/**
 * Performs the installation, streaming newline-delimited JSON so the wizard
 * can show each step as it happens.
 *
 * Creating the tables takes tens of seconds; a single silent request would
 * look indistinguishable from a hang, and could be cut short by an
 * intermediate proxy's read timeout.
 *
 * Validation and authorisation happen before the stream opens, so those
 * failures still arrive as an ordinary JSON error response.
 */
export const POST = handleOpen(async (request: Request) => {
  assertSetupOpen();
  const body = installSchema.parse(await request.json());
  assertSetupKey(body.key);

  const origin = request.headers.get("origin") || new URL(request.url).origin;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: InstallEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await runInstall(
          {
            database: body.database,
            administrator: body.administrator,
            storeName: body.storeName,
            appUrl: origin,
          },
          emit
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Setup failed for an unknown reason.";
        emit({
          kind: "error",
          stepId: error instanceof StepError ? error.stepId : undefined,
          message,
        });
        console.error("[setup] Installation failed:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Tells nginx not to buffer the stream into a single response.
      "X-Accel-Buffering": "no",
    },
  });
});
