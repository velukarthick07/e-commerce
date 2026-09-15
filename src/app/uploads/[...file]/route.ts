import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { handle } from "@/lib/api-response";
import { NotFoundError } from "@/lib/errors";
import { contentTypeFor, storedFilePath } from "@/lib/upload-storage";

type Ctx = { params: Promise<{ file: string[] }> };

/**
 * Serves an uploaded image from disk.
 *
 * This exists because Next only indexes `public/` at boot — a file uploaded a
 * minute ago would 404 until the server restarted. Reading from disk per
 * request makes an image visible the instant it is saved, to staff and
 * shoppers alike.
 *
 * Public by design: product photos are shown on the storefront, which has no
 * session. Only names this app generated (a UUID plus a known image
 * extension) resolve to anything, so the folder cannot be walked or escaped.
 */
export const GET = handle(async (request: Request, ctx: Ctx) => {
  const { file } = await ctx.params;

  // Nested paths are never produced, so anything deeper is a probe.
  if (file.length !== 1) throw new NotFoundError("Image");

  const absolute = storedFilePath(file[0]);
  const contentType = contentTypeFor(file[0]);
  if (!absolute || !contentType) throw new NotFoundError("Image");

  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) throw new NotFoundError("Image");

  // The name contains a UUID and the bytes never change, so this can be
  // cached hard — a re-upload always produces a different URL.
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(info.size),
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`,
  });

  if (request.headers.get("if-none-match") === headers.get("ETag")) {
    return new Response(null, { status: 304, headers });
  }

  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
});
