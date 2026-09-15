import sharp from "sharp";
import { Client } from "./client.mjs";

/**
 * Image uploads: that a file arrives, is compressed, is stored in the folder
 * the app serves from, and is then visible to both staff and shoppers.
 *
 * Test images are generated here rather than committed, so the suite carries
 * no binary fixtures and the numbers reflect a realistic photograph — smooth
 * gradients, hard edges, text and fine grain.
 */

function scene(w, h) {
  const bottles = Array.from({ length: 6 }, (_, i) => {
    const x = 120 + (i * (w - 240)) / 6;
    return `<rect x="${x}" y="${h * 0.35}" width="${(w - 240) / 9}" height="${h * 0.5}" rx="18" fill="url(#g${i % 3})" opacity="0.92"/>`;
  }).join("");
  const grain = Array.from({ length: 700 }, () => {
    const cx = Math.random() * w, cy = Math.random() * h, r = Math.random() * 2.5;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#000" opacity="0.05"/>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f7f2e6"/><stop offset="100%" stop-color="#b9a074"/></linearGradient>
      <linearGradient id="g0" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d8a838"/><stop offset="100%" stop-color="#8a5a12"/></linearGradient>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9ec96b"/><stop offset="100%" stop-color="#3d6b21"/></linearGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8b4a0"/><stop offset="100%" stop-color="#a34e34"/></linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <ellipse cx="${w * 0.5}" cy="${h * 0.88}" rx="${w * 0.42}" ry="${h * 0.08}" fill="#000" opacity="0.10"/>
    ${bottles}
    <text x="60" y="${h * 0.14}" font-family="Georgia,serif" font-size="${Math.round(h * 0.075)}" fill="#3a2d12">Cold Pressed Oils</text>
    ${grain}
  </svg>`);
}

/** Peak signal-to-noise ratio between two images at the same size.
 *  Above ~40 dB the difference is not visible to the eye. */
async function psnr(a, b) {
  const target = await sharp(b).metadata();
  const [rawA, rawB] = await Promise.all([
    sharp(a).resize(target.width, target.height, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(b).removeAlpha().raw().toBuffer(),
  ]);
  let sum = 0;
  for (let i = 0; i < rawA.length; i++) {
    const d = rawA[i] - rawB[i];
    sum += d * d;
  }
  const mse = sum / rawA.length;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

function upload(client, files) {
  const form = new FormData();
  for (const f of files) form.append("files", new Blob([f.buffer], { type: f.type }), f.name);
  return client.call("POST", "/api/uploads", form);
}

const KB = (n) => `${Math.round(n / 1024)} KB`;

export async function uploadScenarios(ctx) {
  const { report, admin, staff, baseUrl } = ctx;
  const M = "Image uploads";
  const anon = new Client(baseUrl, "anon");

  // --- who may upload -----------------------------------------------------
  const photo = await sharp(scene(3000, 2250)).jpeg({ quality: 95 }).toBuffer();
  const one = [{ buffer: photo, type: "image/jpeg", name: "photo.jpg" }];

  report.status(M, "an anonymous visitor cannot upload", await upload(anon, one), 401);
  report.status(M, "staff cannot upload product images", await upload(staff, one), 403);

  // --- the happy path -----------------------------------------------------
  const result = await upload(admin, one);
  report.status(M, "an admin can upload a photograph", result, 201);
  if (result.status !== 201) return;

  const url = result.data.urls[0];
  report.check(M, "the stored file is a compressed WebP", url.endsWith(".webp"), url);
  report.check(M, "it is stored under the public uploads folder", url.startsWith("/uploads/"), url);
  report.check(M, "the file got smaller",
    result.data.storedBytes < result.data.originalBytes,
    `${KB(result.data.originalBytes)} -> ${KB(result.data.storedBytes)}`);

  // --- is it actually served? --------------------------------------------
  const fetched = await fetch(baseUrl + url);
  const bytes = Buffer.from(await fetched.arrayBuffer());
  report.check(M, "the uploaded image is served over HTTP",
    fetched.status === 200 && bytes.length > 0, `HTTP ${fetched.status}, ${bytes.length} bytes`);
  report.check(M, "it is served with an image content-type",
    (fetched.headers.get("content-type") ?? "").startsWith("image/"),
    fetched.headers.get("content-type") ?? "(none)");
  report.check(M, "a shopper can fetch it without signing in",
    (await fetch(baseUrl + url, { headers: {} })).status === 200);

  // --- did compression hurt the picture? ---------------------------------
  const stored = await sharp(bytes).metadata();
  report.check(M, "oversized photos are scaled to fit the configured maximum",
    Math.max(stored.width, stored.height) === 1600,
    `stored at ${stored.width}×${stored.height}`);

  const quality = await psnr(photo, bytes);
  report.check(M, `re-encoding is visually lossless (PSNR ${quality.toFixed(1)} dB, >40 dB is imperceptible)`,
    quality > 40, `PSNR came out at ${quality.toFixed(1)} dB`);
  ctx.created.uploadStats = {
    originalBytes: result.data.originalBytes,
    storedBytes: result.data.storedBytes,
    savedPercent: result.data.savedPercent,
    psnr: quality,
    dimensions: `${stored.width}×${stored.height}`,
  };

  // --- transparency survives ---------------------------------------------
  const logo = await sharp({
    create: { width: 1200, height: 1200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><circle cx="600" cy="600" r="520" fill="#7F56D9"/></svg>`) }])
    .png()
    .toBuffer();
  const logoResult = await upload(admin, [{ buffer: logo, type: "image/png", name: "logo.png" }]);
  report.status(M, "a PNG with transparency uploads", logoResult, 201);
  if (logoResult.status === 201) {
    const got = Buffer.from(await (await fetch(baseUrl + logoResult.data.urls[0])).arrayBuffer());
    const meta = await sharp(got).metadata();
    report.check(M, "transparency is preserved", meta.hasAlpha === true, `hasAlpha=${meta.hasAlpha}`);
    // A transparent corner must still be transparent.
    const corner = await sharp(got).extract({ left: 0, top: 0, width: 8, height: 8 }).ensureAlpha().raw().toBuffer();
    report.check(M, "transparent areas stay transparent", corner[3] === 0, `corner alpha=${corner[3]}`);
  }

  // --- a sideways phone photo comes out upright ---------------------------
  const portrait = await sharp(scene(1800, 2400)).withMetadata({ orientation: 6 }).jpeg({ quality: 90 }).toBuffer();
  const rotatedResult = await upload(admin, [{ buffer: portrait, type: "image/jpeg", name: "phone.jpg" }]);
  report.status(M, "a photo carrying an EXIF rotation uploads", rotatedResult, 201);
  if (rotatedResult.status === 201) {
    const got = Buffer.from(await (await fetch(baseUrl + rotatedResult.data.urls[0])).arrayBuffer());
    const meta = await sharp(got).metadata();
    report.check(M, "EXIF rotation is applied so it is not stored sideways",
      meta.width > meta.height, `stored ${meta.width}×${meta.height} from a 1800×2400 source flagged rotate-90`);
    report.check(M, "EXIF metadata is stripped from the stored file",
      !meta.exif, "exif block still present");
  }

  // --- a small file is never made bigger ---------------------------------
  const tiny = await sharp(scene(400, 400)).webp({ quality: 55 }).toBuffer();
  const tinyResult = await upload(admin, [{ buffer: tiny, type: "image/webp", name: "tiny.webp" }]);
  report.status(M, "an already-optimised image uploads", tinyResult, 201);
  if (tinyResult.status === 201) {
    report.check(M, "compression never makes a file larger",
      tinyResult.data.storedBytes <= tinyResult.data.originalBytes,
      `${tinyResult.data.originalBytes} -> ${tinyResult.data.storedBytes} bytes`);
  }

  // --- several at once ----------------------------------------------------
  const batch = await Promise.all([1, 2, 3].map((i) => sharp(scene(1400 + i * 100, 1000)).jpeg().toBuffer()));
  const batchResult = await upload(admin, batch.map((b, i) => ({ buffer: b, type: "image/jpeg", name: `b${i}.jpg` })));
  report.status(M, "several images upload in one request", batchResult, 201);
  report.check(M, "every file in the batch comes back with a url",
    batchResult.data?.urls?.length === 3, `${batchResult.data?.urls?.length} urls`);

  // --- what must be refused ----------------------------------------------
  const disguised = Buffer.from("<?php system($_GET['c']); ?>".repeat(40));
  report.status(M, "a non-image pretending to be a JPEG is refused",
    await upload(admin, [{ buffer: disguised, type: "image/jpeg", name: "evil.jpg" }]), 400);

  const gif = Buffer.from("GIF89a" + "x".repeat(200));
  report.status(M, "an unsupported image type is refused",
    await upload(admin, [{ buffer: gif, type: "image/gif", name: "anim.gif" }]), 400);

  const huge = Buffer.alloc(6 * 1024 * 1024, 1);
  report.status(M, "a file over the size limit is refused",
    await upload(admin, [{ buffer: huge, type: "image/jpeg", name: "huge.jpg" }]), 400);

  const empty = new FormData();
  report.status(M, "a request with no file is refused",
    await admin.call("POST", "/api/uploads", empty), 400);

  // --- removal ------------------------------------------------------------
  const doomed = await upload(admin, [{ buffer: tiny, type: "image/webp", name: "doomed.webp" }]);
  if (doomed.status === 201) {
    const doomedUrl = doomed.data.urls[0];
    report.status(M, "an image can be deleted",
      await admin.call("DELETE", `/api/uploads?url=${encodeURIComponent(doomedUrl)}`), 200);
    report.check(M, "the deleted file stops being served",
      (await fetch(baseUrl + doomedUrl)).status === 404);
  }

  report.status(M, "a path outside the upload folder cannot be deleted",
    await admin.call("DELETE", "/api/uploads?url=" + encodeURIComponent("../../.env")), 400);

  // --- end to end: staff attach a photo, shoppers see it ------------------
  const products = await admin.get("/api/products?limit=5&isActive=true");
  const product = (products.data ?? [])[0];
  if (product) {
    const full = await admin.get(`/api/products/${product.id}`);
    const body = {
      ...full.data,
      categoryId: full.data.category.id,
      subcategoryId: full.data.subcategory?.id ?? null,
      images: [url],
      variants: full.data.variants.map((v) => ({
        id: v.id, name: v.name, sku: v.sku, mrp: Number(v.mrp), sellingPrice: Number(v.sellingPrice),
        discountPrice: v.discountPrice === null ? undefined : Number(v.discountPrice),
        isDefault: v.isDefault, isActive: v.isActive, sortOrder: v.sortOrder,
        minStock: v.inventory?.minStock ?? 10, maxStock: v.inventory?.maxStock ?? 1000,
      })),
    };
    const saved = await admin.put(`/api/products/${product.id}`, body);
    report.status(M, "an uploaded image can be attached to a product", saved, 200);

    if (saved.status === 200) {
      const shop = await anon.get(`/api/shop/catalogue/${product.slug}`);
      report.check(M, "the shopper-facing catalogue serves the image",
        (shop.data?.images ?? []).includes(url), JSON.stringify(shop.data?.images));

      const html = await (await fetch(`${baseUrl}/shop/p/${product.slug}`)).text();
      report.check(M, "the image appears in the shop page HTML", html.includes(url));
      report.record("uploaded images", `${url} — attached to ${product.name}`);
      ctx.created.uploadedProduct = { slug: product.slug, url, name: product.name };
    }
  }
}
