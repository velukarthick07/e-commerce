import "server-only";
import sharp from "sharp";

/**
 * Image ingestion for uploads.
 *
 * Every accepted file is decoded, re-encoded and written out compressed. The
 * goal is "same picture, smaller file": WebP at a visually-lossless quality,
 * resized only if it is larger than any screen will ever show it.
 */

/** What callers may send. The extension is taken from here, never from the
 *  client's filename, so nothing can be written outside the upload folder. */
export const ALLOWED_UPLOAD_TYPES = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

/** Formats sharp must report after decoding — a file that only *claims* to be
 *  an image will not survive this. */
const DECODABLE = new Set(["jpeg", "png", "webp", "avif", "heif"]);

const MAX_DIMENSION = Number(process.env.IMAGE_MAX_DIMENSION ?? 1600);
const QUALITY = Number(process.env.IMAGE_QUALITY ?? 82);

/** Refuse decompression bombs: a 50MP ceiling is far above any product photo. */
const MAX_PIXELS = 50_000_000;

export interface OptimisedImage {
  buffer: Buffer;
  /** Includes the leading dot, e.g. ".webp". */
  extension: string;
  contentType: string;
  width: number;
  height: number;
  originalBytes: number;
  bytes: number;
  /** True when the re-encoded file was larger and the original was kept. */
  keptOriginal: boolean;
  resized: boolean;
}

export class UnreadableImageError extends Error {}

/**
 * Compresses one image.
 *
 * - EXIF rotation is applied and then all metadata dropped (smaller files, and
 *   phone photos stop arriving sideways; it also strips GPS coordinates, which
 *   have no business being published on a product page).
 * - Oversized images are scaled down to fit `IMAGE_MAX_DIMENSION`, never up.
 * - Output is WebP, which carries alpha and animation and is materially
 *   smaller than JPEG or PNG at the same perceived quality.
 * - If re-encoding somehow produces a *bigger* file than the original, the
 *   original bytes are kept — uploading can never make a file worse.
 */
export async function optimiseImage(
  input: Buffer,
  declaredType: string
): Promise<OptimisedImage> {
  const originalExtension = ALLOWED_UPLOAD_TYPES.get(declaredType);
  if (!originalExtension) {
    throw new UnreadableImageError("Unsupported image type");
  }

  let pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, animated: true });

  let metadata;
  try {
    metadata = await pipeline.metadata();
  } catch {
    throw new UnreadableImageError("That file could not be read as an image");
  }

  // The bytes have to actually *be* an image of a format we accept, whatever
  // the Content-Type header claimed.
  if (!metadata.format || !DECODABLE.has(metadata.format)) {
    throw new UnreadableImageError("That file could not be read as an image");
  }
  if (!metadata.width || !metadata.height) {
    throw new UnreadableImageError("That image has no readable dimensions");
  }

  const animated = (metadata.pages ?? 1) > 1;
  // `animated: true` would treat a still image's single page as a filmstrip on
  // some inputs, so only keep it when there really are multiple frames.
  if (!animated) {
    pipeline = sharp(input, { limitInputPixels: MAX_PIXELS });
  }

  const longestSide = Math.max(metadata.width, metadata.height);
  const resized = longestSide > MAX_DIMENSION;

  const output = await pipeline
    .rotate() // honour EXIF orientation before metadata is dropped
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  if (output.info.size >= input.byteLength) {
    return {
      buffer: input,
      extension: originalExtension,
      contentType: declaredType,
      width: metadata.width,
      height: metadata.height,
      originalBytes: input.byteLength,
      bytes: input.byteLength,
      keptOriginal: true,
      resized: false,
    };
  }

  return {
    buffer: output.data,
    extension: ".webp",
    contentType: "image/webp",
    width: output.info.width,
    height: output.info.height,
    originalBytes: input.byteLength,
    bytes: output.info.size,
    keptOriginal: false,
    resized,
  };
}

/** "1.4 MB" / "812 KB" — for the message the uploader shows. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
