import "server-only";
import path from "node:path";

/**
 * Where uploaded images live, and how they are addressed.
 *
 * They are deliberately NOT under `public/`. Next.js indexes that folder once
 * when the server boots, so anything written later is invisible until a
 * restart — fine for build-time assets, useless for files customers and staff
 * add while the app is running. Uploads are stored in their own folder at the
 * project root and served by `src/app/uploads/[...file]/route.ts`, which reads
 * them from disk on each request.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

/** Extensions we ever write, mapped to what to serve them as. */
export const SERVED_TYPES = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);

/** Stored names are always `<uuid><ext>` — nothing else is readable or
 *  removable, which is what keeps path traversal out of both routes. */
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$/i;

export function isStoredName(name: string): boolean {
  return STORED_NAME.test(name);
}

/** Absolute path to the upload folder. */
export function uploadRoot(): string {
  const configured = UPLOAD_DIR;
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

/**
 * Absolute path for one stored file, or null if the name is not one of ours.
 * The result is re-checked against the root so a crafted name can never escape
 * the folder even if the pattern above is ever loosened.
 */
export function storedFilePath(name: string): string | null {
  if (!isStoredName(name)) return null;
  const root = uploadRoot();
  const resolved = path.resolve(root, name);
  return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
}

/** The URL the browser asks for. */
export function publicUrl(filename: string): string {
  return `/uploads/${filename}`;
}

export function contentTypeFor(filename: string): string | null {
  return SERVED_TYPES.get(path.extname(filename).toLowerCase()) ?? null;
}
