import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Client } from "./client.mjs";

/**
 * Every endpoint is discovered by scanning the route handlers and reading the
 * permission each one demands, so this sweep cannot drift out of step with the
 * code: adding a route automatically adds it to the matrix.
 */
export function discoverEndpoints(apiDir = "src/app/api") {
  const files = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") files.push(full);
    }
  })(apiDir);

  const endpoints = [];
  for (const file of files.sort()) {
    const source = readFileSync(file, "utf8");
    const route = "/" + file.replace(`${apiDir}/`, "").replace("/route.ts", "");
    const pattern = /export const (GET|POST|PUT|PATCH|DELETE) = handle\(/g;
    let match;
    while ((match = pattern.exec(source))) {
      const method = match[1];
      const tail = source.slice(match.index, match.index + 800);
      const permission = /requirePermission\(\s*"([^"]+)"/.exec(tail)?.[1];
      const guard = permission
        ? "permission"
        : /requireCustomer\(/.test(tail)
          ? "customer"
          : /getCustomerSession\(/.test(tail)
            ? "public"
            : /requireAuth\(/.test(tail)
              ? "staff"
              : "public";
      endpoints.push({ method, route, permission, guard });
    }
  }
  return endpoints;
}

/** Bogus but well-formed path params: authorisation runs before any lookup, so
 *  an allowed role gets 404/422 here and a denied role still gets 403. */
function concretePath(route) {
  return route
    .replace("[id]", /categories|users/.test(route) ? "999999" : "qa-missing-id")
    .replace("[type]", "sales")
    .replace("[slug]", "qa-missing-slug")
    .replace("[orderNumber]", "QA-MISSING-0000");
}

/** Logging out would destroy the session the sweep is using. Covered separately. */
const SKIP = new Set(["POST /auth/logout", "POST /shop/auth/logout"]);

export async function runRbacMatrix(baseUrl, staff, report) {
  const endpoints = discoverEndpoints().filter((e) => !SKIP.has(`${e.method} ${e.route}`));
  const anon = new Client(baseUrl, "anonymous");

  for (const endpoint of endpoints) {
    const path = "/api" + concretePath(endpoint.route);
    const body = endpoint.method === "GET" ? undefined : {};
    const label = `${endpoint.method} ${endpoint.route}`;

    // --- anonymous ---
    const anonymous = await anon.call(endpoint.method, path, body);
    if (endpoint.guard === "public") {
      report.check(
        "RBAC · anonymous",
        `${label} is public`,
        ![401, 403].includes(anonymous.status),
        `got ${anonymous.status} ${anonymous.message ?? ""}`
      );
    } else {
      report.status("RBAC · anonymous", `${label} rejects anonymous`, anonymous, 401);
    }

    // --- each staff role ---
    for (const client of staff) {
      const result = await client.call(endpoint.method, path, body);
      const group = `RBAC · ${client.role}`;

      if (endpoint.guard === "permission") {
        const allowed = client.permissions.includes(endpoint.permission);
        if (allowed) {
          report.check(group, `${label} allowed (${endpoint.permission})`, result.status !== 403,
            `got 403 despite holding ${endpoint.permission}`);
        } else {
          report.status(group, `${label} denied (needs ${endpoint.permission})`, result, 403);
        }
      } else if (endpoint.guard === "customer") {
        report.status(group, `${label} rejects a staff session`, result, 401);
      } else if (endpoint.guard === "staff") {
        report.check(group, `${label} allowed for any signed-in staff`, ![401, 403].includes(result.status),
          `got ${result.status}`);
      } else {
        report.check(group, `${label} is public`, ![401, 403].includes(result.status), `got ${result.status}`);
      }
    }
  }

  return endpoints.length;
}
