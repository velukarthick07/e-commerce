/**
 * The install wizard, on an installation that has already been set up.
 *
 * Everything here asserts an *absence*. Once a store is live, /setup is a
 * form that creates an administrator without asking anyone to sign in, so the
 * only acceptable behaviour is that it has disappeared — and that it did not
 * take anything else with it on the way out.
 */

async function head(url) {
  const response = await fetch(url, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

async function json(url, init) {
  const response = await fetch(url, init);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

export async function setupScenarios(ctx) {
  const { baseUrl, report } = ctx;
  const M = "Setup";

  // --- The wizard is closed -----------------------------------------------
  const status = await json(`${baseUrl}/api/setup/status`);
  report.check(
    M,
    "status endpoint reports the installation as complete",
    status.status === 200 && status.body?.data?.required === false,
    `status ${status.status}, required=${status.body?.data?.required}`
  );
  report.check(
    M,
    "status endpoint records when setup finished",
    typeof status.body?.data?.completedAt === "string" && status.body.data.completedAt.length > 0,
    `completedAt=${status.body?.data?.completedAt}`
  );
  report.check(
    M,
    "no setup key is on offer once installed",
    status.body?.data?.keyRequired === false,
    `keyRequired=${status.body?.data?.keyRequired}`
  );

  const page = await head(`${baseUrl}/setup`);
  report.check(
    M,
    "the /setup page redirects to sign-in",
    page.status === 307 && page.location.endsWith("/login"),
    `${page.status} -> ${page.location}`
  );

  // --- Provisioning endpoints are gone ------------------------------------
  const requirements = await json(`${baseUrl}/api/setup/requirements`);
  report.check(
    M,
    "the requirements endpoint is gone",
    requirements.status === 404,
    `status ${requirements.status}`
  );

  const probe = await json(`${baseUrl}/api/setup/database`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: "GUESS-GUESS-GUESS-GUESS",
      database: { host: "localhost", port: 5432, user: "postgres", password: "x", database: "anything", ssl: false },
    }),
  });
  report.check(
    M,
    "the database probe refuses to run",
    probe.status === 404,
    `status ${probe.status}`
  );

  const install = await json(`${baseUrl}/api/setup/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: "GUESS-GUESS-GUESS-GUESS",
      storeName: "Someone Else's Shop",
      database: { host: "localhost", port: 5432, user: "postgres", password: "x", database: "anything", ssl: false },
      administrator: {
        name: "Uninvited Guest", email: "guest@elsewhere.test", phone: "",
        password: "Password1", confirmPassword: "Password1",
      },
    }),
  });
  report.check(
    M,
    "no second administrator can be installed",
    install.status === 404,
    `status ${install.status}`
  );

  // --- The gate did not swallow the rest of the API -----------------------
  const store = await json(`${baseUrl}/api/shop/store`);
  report.check(
    M,
    "public endpoints still answer normally",
    store.status === 200 && store.body?.success === true,
    `status ${store.status}`
  );

  const guarded = await json(`${baseUrl}/api/products`);
  report.check(
    M,
    "protected endpoints still answer 401, not 503",
    guarded.status === 401 && guarded.body?.error?.code !== "SETUP_REQUIRED",
    `status ${guarded.status}, code ${guarded.body?.error?.code}`
  );
}
