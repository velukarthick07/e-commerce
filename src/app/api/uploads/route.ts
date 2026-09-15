import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { created, handle, ok } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth";
import { BadRequestError } from "@/lib/errors";
import {
  ALLOWED_UPLOAD_TYPES,
  UnreadableImageError,
  formatBytes,
  optimiseImage,
} from "@/lib/images";
import { isStoredName, publicUrl, storedFilePath, uploadRoot } from "@/lib/upload-storage";

/**
 * Image uploads. Multer is Express middleware and cannot run inside a Next.js
 * Route Handler, so this uses the standard Web FormData API instead.
 *
 * Files are written into the `uploads/` folder at the project root and served
 * by `app/uploads/[...file]`, so an image is visible to staff and shoppers the
 * moment it lands — see `lib/upload-storage.ts` for why it cannot live under
 * `public/`. Each one is re-encoded and compressed on the way in (`lib/images.ts`).
 *
 * Safety: the file must actually decode as an image, the extension comes from
 * our own allow-list rather than the client's filename, and the stored name is
 * a generated UUID — so nothing can be written outside the upload folder.
 */
const MAX_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);
const MAX_FILES = 10;

export const POST = handle(async (request: NextRequest) => {
  await requirePermission("products:create", request);

  const form = await request.formData().catch(() => null);
  if (!form) throw new BadRequestError("Expected a multipart form upload");

  const entries = form.getAll("files").filter((f): f is File => f instanceof File);
  const single = form.get("file");
  if (single instanceof File) entries.push(single);

  if (entries.length === 0) throw new BadRequestError("No file was uploaded");
  if (entries.length > MAX_FILES) {
    throw new BadRequestError(`Upload at most ${MAX_FILES} images at a time`);
  }

  const absoluteDir = uploadRoot();
  await mkdir(absoluteDir, { recursive: true });

  const urls: string[] = [];
  let originalTotal = 0;
  let storedTotal = 0;

  for (const file of entries) {
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      throw new BadRequestError(
        `${file.name || "File"} is not a supported image (use JPEG, PNG, WebP or AVIF)`
      );
    }
    // Checked against the *upload* size: compression happens after this, so the
    // limit is about what we are willing to receive, not what we keep.
    if (file.size > MAX_MB * 1024 * 1024) {
      throw new BadRequestError(
        `${file.name || "File"} is larger than the ${MAX_MB}MB limit`
      );
    }

    const source = Buffer.from(await file.arrayBuffer());

    let image;
    try {
      image = await optimiseImage(source, file.type);
    } catch (error) {
      if (error instanceof UnreadableImageError) {
        throw new BadRequestError(`${file.name || "File"}: ${error.message}`);
      }
      throw error;
    }

    const filename = `${randomUUID()}${image.extension}`;
    await writeFile(path.join(absoluteDir, filename), image.buffer);

    originalTotal += image.originalBytes;
    storedTotal += image.bytes;
    urls.push(publicUrl(filename));
  }

  const saved = originalTotal - storedTotal;
  const percent = originalTotal > 0 ? Math.round((saved / originalTotal) * 100) : 0;
  const count = `${urls.length} image${urls.length === 1 ? "" : "s"}`;

  return created(
    {
      urls,
      originalBytes: originalTotal,
      storedBytes: storedTotal,
      savedBytes: saved,
      savedPercent: percent,
    },
    saved > 0
      ? `${count} uploaded — compressed from ${formatBytes(originalTotal)} to ${formatBytes(storedTotal)} (${percent}% smaller)`
      : `${count} uploaded`
  );
});

export const DELETE = handle(async (request: NextRequest) => {
  await requirePermission("products:update", request);

  const url = request.nextUrl.searchParams.get("url");
  if (!url) throw new BadRequestError("An image url is required");

  // Only files we generated, inside the upload directory, can be removed.
  const filename = path.basename(url);
  const absolute = isStoredName(filename) ? storedFilePath(filename) : null;
  if (!absolute) throw new BadRequestError("That file cannot be removed");

  await unlink(absolute).catch(() => undefined);
  return ok({ url }, "Image removed");
});
