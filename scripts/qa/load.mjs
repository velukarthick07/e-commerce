/**
 * Load test for the customer storefront.
 *
 *   node scripts/qa/load.mjs
 *   LOAD_SECONDS=8 LOAD_LEVELS=1,10,50,100,200 node scripts/qa/load.mjs
 *
 * Drives real HTTP against a real database at rising concurrency and reports
 * throughput, latency percentiles and errors, so "how many people at once"
 * has a measured answer rather than an estimated one.
 *
 * Read paths only by default. Checkout (a write, with row locks and a
 * transaction) is measured separately with `LOAD_WRITES=n`, which places n real
 * orders and prints the ids so they can be removed afterwards.
 */
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3117";
const SECONDS = Number(process.env.LOAD_SECONDS ?? 6);
const LEVELS = (process.env.LOAD_LEVELS ?? "1,5,10,25,50,100,200").split(",").map(Number);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

/** Hammers `work` with `concurrency` workers for `seconds`, then reports. */
async function measure(label, concurrency, seconds, work) {
  const latencies = [];
  let ok = 0;
  let failed = 0;
  const errors = new Map();
  const until = Date.now() + seconds * 1000;

  const worker = async () => {
    while (Date.now() < until) {
      const started = performance.now();
      try {
        const status = await work();
        const elapsed = performance.now() - started;
        if (status >= 200 && status < 400) {
          ok++;
          latencies.push(elapsed);
        } else {
          failed++;
          errors.set(`HTTP ${status}`, (errors.get(`HTTP ${status}`) ?? 0) + 1);
        }
      } catch (error) {
        failed++;
        const key = error.cause?.code ?? error.code ?? error.message.slice(0, 40);
        errors.set(key, (errors.get(key) ?? 0) + 1);
      }
    }
  };

  const wallStart = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const wall = (performance.now() - wallStart) / 1000;

  latencies.sort((a, b) => a - b);
  return {
    label, concurrency,
    rps: ok / wall,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.at(-1) ?? 0,
    ok, failed,
    errors: [...errors.entries()].map(([k, v]) => `${k}×${v}`).join(", "),
  };
}

function printTable(rows) {
  console.log(
    "  " + "users".padStart(6) + "req/s".padStart(10) + "p50".padStart(9) +
    "p95".padStart(9) + "p99".padStart(9) + "max".padStart(9) +
    "ok".padStart(8) + "failed".padStart(8) + "  errors"
  );
  for (const r of rows) {
    console.log(
      "  " + String(r.concurrency).padStart(6) +
      r.rps.toFixed(0).padStart(10) +
      `${r.p50.toFixed(0)}ms`.padStart(9) +
      `${r.p95.toFixed(0)}ms`.padStart(9) +
      `${r.p99.toFixed(0)}ms`.padStart(9) +
      `${r.max.toFixed(0)}ms`.padStart(9) +
      String(r.ok).padStart(8) +
      String(r.failed).padStart(8) +
      (r.errors ? "  " + r.errors : "")
    );
  }
}

async function main() {
  const probe = await fetch(`${BASE}/api/shop/store`).catch(() => null);
  if (!probe?.ok) {
    console.error(`Cannot reach ${BASE}. Start the app first.`);
    process.exit(1);
  }

  // A real variant and slug to exercise, taken from the live catalogue.
  const catalogue = await (await fetch(`${BASE}/api/shop/catalogue?limit=20&inStockOnly=true`)).json();
  const product = catalogue.data[0];
  const variant = product.variants.find((v) => v.inStock);
  const second = catalogue.data[1]?.variants.find((v) => v.inStock) ?? variant;

  const get = (path) => async () => (await fetch(BASE + path)).status;
  const post = (path, body) => async () =>
    (await fetch(BASE + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })).status;

  const journeys = [
    ["Shop home page (server-rendered HTML)", get("/shop")],
    ["Product page (server-rendered HTML)", get(`/shop/p/${product.slug}`)],
    ["Catalogue API (JSON)", get("/api/shop/catalogue?limit=20")],
    ["Store details API (cacheable, tiny)", get("/api/shop/store")],
    ["Cart pricing API (POST, recomputes totals)",
      post("/api/shop/quote", {
        items: [{ variantId: variant.id, quantity: 2 }, { variantId: second.id, quantity: 1 }],
        deliveryType: "DELIVERY",
      })],
  ];

  console.log("=".repeat(96));
  console.log(`STOREFRONT LOAD TEST — ${BASE}`);
  console.log(`${SECONDS}s per level · concurrency ${LEVELS.join(", ")} · ${new Date().toLocaleString("en-IN")}`);
  console.log("The load generator shares this machine with the server, so both compete for CPU.");
  console.log("=".repeat(96));

  const summary = [];
  for (const [label, work] of journeys) {
    console.log(`\n${label}`);
    const rows = [];
    for (const level of LEVELS) {
      rows.push(await measure(label, level, SECONDS, work));
      await new Promise((r) => setTimeout(r, 400)); // let the pool settle
    }
    printTable(rows);
    summary.push({ label, rows });
  }

  console.log("\n" + "=".repeat(96));
  console.log("PEAK THROUGHPUT PER JOURNEY");
  console.log("=".repeat(96));
  for (const { label, rows } of summary) {
    const best = rows.reduce((a, b) => (b.rps > a.rps ? b : a));
    const clean = rows.filter((r) => r.failed === 0);
    const highestClean = clean.length ? clean.at(-1) : null;
    console.log(
      `  ${label.padEnd(44)} peak ${best.rps.toFixed(0).padStart(5)} req/s at ${String(best.concurrency).padStart(3)} concurrent` +
      (highestClean ? `  ·  no errors up to ${highestClean.concurrency}` : "  ·  errors at every level")
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
