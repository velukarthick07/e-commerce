# FMCG E-commerce — Admin Panel, Local Orders and Customer Storefront

A production-shaped application for an FMCG store selling edible oils, health
mixes, groceries, snacks, personal care and household products. It has three
faces sharing one database and one order pipeline:

| | Where | Who |
|---|---|---|
| **Storefront** | `/shop` | Customers — browse, order, track. No account required. |
| **Local orders** | `/local-orders` | Counter staff taking walk-in and phone orders |
| **Admin panel** | `/dashboard` | Staff — catalogue, stock, orders, reports |

`/` sends staff with a live session to the dashboard and everyone else to the shop.

Staff of every role can open **`/help`** — a user manual written for the people
running the shop, covering each screen as a task ("taking an order at the
counter", "writing off expired stock"). It marks the sections the reader's own
role cannot open, so a manager can see what their staff see. Its content lives in
`src/components/help/manual-content.ts`, as data rather than markup, so it can be
searched and edited without touching the page.

Built as a single **Next.js 16** application: React UI, Route Handlers for the API,
and PostgreSQL through Prisma.

```
Route Handlers → Validators (Zod) → Services → Repositories → Prisma → PostgreSQL
```

---

## Quick start

**Requirements:** Node.js 20.9+, PostgreSQL 13+ (developed against 18).

### Deploying to a server

Use the install wizard — it checks the machine, creates the database, builds
the tables and creates the first administrator, then closes itself:

```bash
npm install          # not --omit=dev: the Prisma CLI creates the tables
npm run build
npm start            # then open /setup and follow the four steps
```

Until setup finishes, every page redirects to `/setup` and every API route
answers `503 SETUP_REQUIRED`. Afterwards `/setup` is gone for good. The server
prints a one-time **setup key** on startup which the wizard asks for, so that
only someone with access to the machine can create the first account.

**[SETUP.md](SETUP.md)** covers all of it: what the checks mean, installing
without a browser, re-running setup, upgrading a store that is already live,
and what to do when a step fails.

### Developing locally

To skip the wizard and get a database full of demo data:

```bash
# 1. Install (also generates the Prisma client)
npm install

# 2. Configure the database + secrets
cp .env.example .env
#    edit DATABASE_URL and JWT_SECRET

# 3. Create the schema and load demo data
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev          # http://localhost:3000
```

> **DATABASE_URL** is a standard Postgres URL. Percent-encode special characters
> in the password (`:` → `%3A`, `#` → `%23`, `@` → `%40`).

### Demo accounts

Created by the seed; override them with the `SEED_*` variables in `.env`.

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@fmcg.local` | `SuperAdmin@123` |
| Admin | `admin@fmcg.local` | `Admin@123` |
| Manager | `manager@fmcg.local` | `Manager@123` |
| Staff | `staff@fmcg.local` | `Staff@123` |

Staff sign in at **`/login`**.

### Trying the shop

The storefront is at **`/shop`** and needs no account — add something to the
cart, check out as a guest and track the order with its number and your mobile.

To try the signed-in experience, use a mobile number the seed already created,
for example **9840012345** (Lakshmi Narayanan), **9840023456** (Ravi Shankar) or
**9840056789** (Meena Sundaram). There is no SMS provider, so the 6-digit code is
shown on screen and logged to the server console. Any unrecognised 10-digit
number works too — you will be asked for a name and an account is created.

Orders placed on the shop appear immediately under **Online Orders** in the admin
sidebar, where staff confirm, pack and dispatch them.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio |
| `npm run qa` | Full QA pass — every role against every module (see below) |

---

## Project structure

```
scripts/qa/              QA suite — see "Testing" below
uploads/                 Uploaded product images (runtime data, gitignored)
prisma/
  schema.prisma          Data model (20 models)
  migrations/            SQL migrations
  seed.ts, seed-data.ts  Demo data — runs through the real order service
src/
  app/
    (auth)/              Staff login, forgot password, reset password
    (app)/               Staff shell: dashboard, orders, products, …
    (shop)/              Customer storefront: catalogue, cart, checkout, account
    api/                 Route Handlers (the entire backend API)
    api/shop/            The public storefront API
  components/
    common/              DataTable, StatCard, EmptyState, ConfirmDialog, …
    layout/              Topbar, Sidebar, AppShell, GlobalSearch
    shop/                Storefront header, product card, checkout, OTP sign-in
    local-order/         Customer picker, product picker, cart
    products/            Product form, variant editor, image uploader
    charts/              Recharts wrappers
  services/              Business logic (order, product, inventory, …)
  repositories/          All Prisma queries
  validators/            Zod request schemas
  lib/                   prisma, auth, jwt, money, permissions, api-response
  types/                 Shared and API DTO types
  theme/                 MUI theme and palette
  proxy.ts               Route protection (Next 16's renamed middleware)
```

---

## How the important parts work

### Money and order totals

The backend is the only source of truth for prices (spec §28). The client sends
**only `variantId` and `quantity`** — never a price or a total. `orderService`
re-reads the current variant price from the database and recomputes everything.

All arithmetic runs in **integer paise** (`lib/money.ts`) so repeated percentage
and discount operations cannot accumulate floating-point drift. Order-level
discounts are allocated across lines in proportion to line value, with the last
line absorbing the rounding remainder, so the parts always sum to the whole.

`POST /api/orders/quote` runs the exact same calculation as order creation, so
the figures on screen are the figures that get charged.

**Tax:** controlled by Settings → Tax. The default is `pricesIncludeTax: true`,
which matches Indian MRP-based FMCG pricing — tax is *extracted* from the price
for reporting and the customer pays the listed price. Turning that off switches
to the spec's literal `subtotal − discounts + tax + delivery` formula, where tax
is added on top.

### Inventory, batches and FEFO

Inventory attaches to a **variant**, not a product; every product has at least
one variant. Expiry-tracked products additionally hold `InventoryBatch` rows.

When an order is fulfilled, `deductStockFEFO` consumes batches in ascending
expiry order (**First Expiry, First Out**), writing one `InventoryTransaction`
per batch consumed so every movement is traceable back to its batch and order.
Products that are not batch-tracked deduct against a null batch.

Concurrency is handled with `SELECT … FOR UPDATE` on the inventory row inside
the transaction, so two simultaneous orders cannot oversell the same stock.

Cancelling or returning an order restores stock to the batches it came from and
releases the coupon use.

### Authentication and authorisation

JWT in an **httpOnly cookie** (`jose`, HS256), passwords hashed with bcrypt
(12 rounds). `proxy.ts` performs an optimistic redirect for page routes; real
authorisation happens in every Route Handler via `requirePermission`, which
**re-reads the user from the database on every request** — so deactivating a
user or changing their role takes effect immediately rather than at token expiry.

Permissions are a `resource:action` matrix in `lib/permissions.ts`, seeded into
the `permissions` / `role_permissions` tables and used for both API enforcement
and sidebar visibility.

### The customer storefront

The shop at `/shop` is open to the world — no session is needed to browse, price
a cart or place an order. It reuses the same pipeline as the counter app, so
storefront orders get identical pricing, FEFO stock deduction, coupon accounting
and ledger entries. The only difference is that no staff user is attached
(`createdByUserId`, the ledger's `userId` and the payment's `recordedByUserId`
are all null), which is how the admin can tell a customer order from a counter one.

**Ordering without an account.** A guest enters their mobile number, name and
address and checks out. The order is filed against a `Customer` record keyed on
the phone number — reusing the existing one if the shop already knows that
number — so every order a person places lands in one customer profile whether
they signed in or not.

**Signing in** is mobile number + a 6-digit OTP. There is no password, which
means customers the admin created by hand can sign in on day one without anyone
issuing them credentials. Signing in fills the checkout in, unlocks the saved
address book and shows full order history. Codes are stored as a **keyed HMAC**
rather than in plain text — six digits has too little entropy for a plain hash
to help, so the digest is keyed with the server secret. Codes expire in 10
minutes, allow 5 wrong attempts, are invalidated when a newer one is issued, and
are capped at 5 sends per number per 15 minutes.

> **No SMS provider is wired up.** Codes are logged to the server console, and
> with `OTP_ECHO=true` (the default outside production) also returned in the API
> response so the flow is usable. Implement `deliverOtp` in `src/lib/otp.ts` and
> set `OTP_ECHO=false` to go live — nothing else changes.

**Recognising a returning shopper.** When a guest types a number the shop knows,
the checkout says so — but with a **masked** name and locality only
(`L•••••• N••••••••`, `••••••, Chennai 600017`), behind a one-tap "Verify"
button. The full name and saved addresses are released after the OTP step.

> This is a deliberate departure from a literal reading of "fill in their
> details from the mobile number". Returning the real name and address for any
> number typed in would turn an unauthenticated endpoint into a lookup service
> for the shop's entire customer list. Set `STOREFRONT_OPEN_AUTOFILL=true` for
> the literal behaviour.

**The address book.** A customer can save as many addresses as they like (capped
at 10) with exactly one marked default. That invariant is enforced inside a
transaction on every mutation rather than trusted from the client: the first
address saved becomes the default automatically, promoting one demotes the
others, and deleting the default promotes the oldest survivor.

**Tracking** needs the order number *and* the mobile it was placed with. Order
numbers run in a daily sequence and are therefore guessable, so the pair is what
makes lookup safe; "no such order" and "wrong number" return the same message so
neither can be used to probe the other. Signed-in customers skip all that and see
their whole history. The order a shopper just placed is remembered in
`sessionStorage` — not in the URL — so the confirmation page works for guests
without putting a phone number into browser history or a referrer header.

**Two independent sessions.** Staff hold `fmcg_session`; customers hold
`fmcg_customer`. Both are httpOnly JWTs signed with the same secret, but the
customer token carries `aud: "customer"` and each verifier rejects the other's
audience — a customer cookie can never be replayed as a staff session, or the
reverse. A staff member browsing the shop is just a shopper, and vice versa.

**What the shop can see.** The catalogue query exposes price, availability and
product copy; purchase prices, batch numbers, stock thresholds and supplier data
never leave the server. Order responses to customers omit the inventory ledger,
batch allocations and internal staff notes on status changes.

### What the shop can't decide for itself

The checkout sends only `variantId`, `quantity`, contact details and an address.
Prices, discounts, delivery charge, order status and payment status are all
computed server-side. A request claiming `grandTotal: 1`, `paymentStatus: PAID`
and `status: DELIVERED` is charged the real total and lands as `PENDING`/unpaid
like any other order.

Delivery charge comes from Settings (flat charge, free above a threshold) and is
calculated by one function used by both `/api/shop/quote` and the order itself,
so the figure quoted in the cart is provably the figure charged.

### Product images

Uploads go through `POST /api/uploads` (Web `FormData`; Multer is Express-only
and cannot run in a Route Handler) and are **compressed on the way in**:

- decoded with `sharp`, EXIF rotation applied, then all metadata dropped — files
  get smaller, phone photos stop arriving sideways, and GPS coordinates never
  reach a public product page;
- scaled to fit `IMAGE_MAX_DIMENSION` (1600px) on the longest side, never up;
- re-encoded to WebP at `IMAGE_QUALITY` (82), which carries alpha and animation;
- and if re-encoding ever came out *larger*, the original bytes are kept — an
  upload cannot make a file worse.

A 3200×2400 camera JPEG lands about **93% smaller**, at a PSNR of ~45 dB against
the original — comfortably past the ~40 dB where a difference stops being
visible.

Files are stored in **`uploads/` at the project root — deliberately not under
`public/`**. Next.js indexes `public/` once when the server boots, so an image
uploaded afterwards would 404 until a restart. `app/uploads/[...file]` reads
them from disk per request instead, so a photo is live the instant it is saved,
for staff and shoppers alike. Stored names are a UUID plus an extension from our
own allow-list, which is also what keeps path traversal out; the bytes must
actually decode as an image, so a script renamed `.jpg` is refused. Responses
carry `immutable` caching, since a re-upload always produces a new URL.

To move uploads to S3 or a CDN later, the seam is `lib/upload-storage.ts` plus
those two routes — nothing else knows where the bytes live.

### First-run setup

Whether the wizard exists is decided by a file, `.setup-complete.json`, not by
a database lookup — the entire point of setup is that there may not be a
database to look in. Two gates read it: the proxy, which redirects pages to
`/setup`; and `handle()` in `lib/api-response.ts`, the wrapper every one of the
65 route handlers already goes through, which answers `503 SETUP_REQUIRED`.
The API is gated there rather than in the proxy because an API must return JSON,
not a redirect.

Three things are easy to get wrong here, and are worth knowing about:

**An upgrade must not offer to reinstall a live store.** Dropping this code into
a running shop gives you a database full of orders and no marker file. So at
startup (`src/instrumentation.ts`) the application looks at the database it is
already configured for; if it finds user accounts, it writes the marker itself
and logs that the wizard is disabled. The same check means `setup:reset` cannot
reopen setup on a populated database.

**Next.js reads `.env` once, at boot.** Setup writes the database credentials
into a server that is already running, so the file alone would do nothing until
a restart. It therefore also sets `process.env` in the live process and drops
the cached Prisma client, which is why the app works the moment the wizard
finishes. `.env` is written last, after every step that can fail — partly so a
failure leaves no half-written config, and partly because in development
Next.js restarts on `.env` changes, which would kill the request doing the
writing. The browser copes with that too: if the stream ends early it asks
`/api/setup/status` rather than reporting a failure that did not happen.

**The first administrator is created without authentication.** That is
unavoidable — there is no account to authenticate against yet. Three things
limit it: the endpoints return 404 the moment installation completes; setup
refuses any database that already contains user accounts; and the wizard asks
for a one-time key printed to the server console and saved to `.setup-key`,
which is deleted on success. Set `SETUP_REQUIRE_KEY=false` to skip the key on a
machine nothing else can reach.

The `(shop)` segment is `force-dynamic` for a related reason. Every storefront
page renders the store's name and delivery rules from the database, and on a new
server the build runs before setup, when there is no store to name. Prerendering
would also have meant renaming the store under Settings never reaching those
pages until someone rebuilt the app.

### API conventions

Every endpoint returns the documented envelope:

```jsonc
{ "success": true,  "message": "Order created successfully", "data": {}, "meta": {} }
{ "success": false, "message": "Unable to create order",     "error": { "code": "…" } }
```

`lib/api-response.ts` translates Zod errors (→ 422 with per-field messages),
`AppError` subclasses, and Prisma error codes (P2002 → 409, P2025 → 404,
P2003 → 409) into that shape. Unexpected errors are logged server-side and
returned as a generic message — stack traces never reach the client.

---

## Testing

```bash
npm start          # or npm run dev
npm run qa         # against http://localhost:3117 by default
QA_BASE_URL=http://localhost:3000 npm run qa
```

`scripts/qa/` drives the real HTTP API against the real database — no mocks, no
fixtures, no test doubles. It runs in two parts.

**1. An exhaustive authorisation sweep.** Every route handler is discovered by
scanning `src/app/api/**/route.ts`, and the permission each one demands is read
out of the code rather than restated in the test. Each endpoint is then called
anonymously and as all four roles, and the expected outcome is *derived* from
that role's live permission list. Adding a route adds it to the matrix
automatically, so the two can never drift apart.

**2. A functional pass over every module**, each step performed by a role that
should be able to do it, covering the happy path, the authorisation boundary and
the business rules that should refuse it — duplicate SKUs and phone numbers,
deleting a category that still has products, overselling stock, discounts above
the configured cap, expired and exhausted coupons, impossible status
transitions, and clients that try to name their own price.

### The data is kept

The functional pass **leaves everything it creates in the database**, so the app
can be explored with a worked example of every state it models: orders in all
nine statuses across all six order types, payments in all four statuses across
all four methods, every inventory ledger type including expiry write-offs,
batches in every expiry bucket, coupons that are live, expired, not yet started,
switched off and used up, users in every role plus a deactivated one, customers
with no address, one address and several, and shop orders placed both as a guest
and signed in.

Each run tags its rows with a short id (printed at the end, e.g. `run id GFGK`) —
search for it in the admin to find everything a given pass created. Re-running is
safe and additive; `npm run db:reset` returns to just the seed data.

---

## API reference

### Storefront — `/api/shop/*`

Public unless marked. "Customer" means a `fmcg_customer` session (mobile + OTP);
these routes never accept a staff session.

| Area | Endpoints |
|---|---|
| Catalogue | `GET /api/shop/catalogue`, `GET /api/shop/catalogue/[slug]`, `GET /api/shop/categories`, `GET /api/shop/store` |
| Cart & checkout | `POST /api/shop/quote`, `POST /api/shop/lookup`, `POST /api/shop/orders` |
| Tracking | `POST /api/shop/track` (order number + mobile) |
| Sign-in | `POST /api/shop/auth/otp`, `POST /api/shop/auth/verify`, `POST /api/shop/auth/logout` |
| Account *(customer)* | `GET /api/shop/auth/me`, `PATCH /api/shop/profile`, `GET /api/shop/orders`, `GET /api/shop/orders/[orderNumber]` |
| Addresses *(customer)* | `GET/POST /api/shop/addresses`, `PUT/DELETE /api/shop/addresses/[id]`, `POST /api/shop/addresses/[id]/default` |

### Admin and counter

All routes require a staff session unless noted.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` (public), `logout`, `GET me`, `POST forgot-password` (public), `reset-password` (public), `change-password` |
| Products | `GET/POST /api/products`, `GET/PUT/PATCH/DELETE /api/products/[id]`, `GET /api/products/search`, `/barcode`, `/brands` |
| Categories | `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/[id]`, `GET /api/categories/tree` |
| Customers | `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/[id]`, `GET /api/customers/search`, `POST /api/customers/quick`, `GET /api/customers/[id]/orders` |
| Orders | `GET/POST /api/orders`, `GET /api/orders/[id]`, `PATCH /api/orders/[id]/status`, `PATCH /api/orders/[id]/payment`, `POST /api/orders/quote` |
| Local orders | `GET/POST /api/local-orders` |
| Online orders | The admin screen at `/online-orders` is `GET /api/orders?channel=ONLINE` |
| Inventory | `GET /api/inventory`, `/summary`, `/transactions`, `POST /api/inventory/adjust`, `PATCH /api/inventory/min-max` |
| Batches / expiry | `GET/POST /api/inventory/batches`, `GET/PUT/DELETE /api/inventory/batches/[id]`, `GET /api/inventory/expiry`, `POST /api/inventory/expiry/write-off` |
| Payments | `GET/POST /api/payments`, `GET/PATCH /api/payments/[id]` |
| Coupons | `GET/POST /api/coupons`, `GET/PUT/DELETE /api/coupons/[id]`, `POST /api/coupons/validate` |
| Reports | `GET /api/reports/dashboard`, `GET /api/reports/[type]` — `sales`, `orders`, `products`, `customers`, `inventory`, `payments`, `local-orders` (`?format=csv` exports) |
| Settings | `GET/PUT /api/settings` |
| Users | `GET/POST /api/users`, `GET/PUT/DELETE /api/users/[id]`, `GET /api/users/roles`, `PUT /api/profile` |
| Uploads | `POST/DELETE /api/uploads` · `GET /uploads/[file]` (public) |
| Setup | `GET /api/setup/status` · `GET /api/setup/requirements` · `POST /api/setup/database` · `POST /api/setup/install` (NDJSON stream) — all but `status` return 404 once installed |

---

## Notes on this build

A few places where the spec was internally inconsistent, and what was done:

- **MongoDB references (§39, §56)** — leftovers from an earlier version of the
  spec that otherwise specifies PostgreSQL throughout. Settings persist in
  Postgres; `.env.example` uses `DATABASE_URL`.
- **Multer (§54)** — Express middleware; it cannot run inside a Next.js Route
  Handler. Uploads use the standard Web `FormData` API with a MIME allow-list,
  size cap, and UUID filenames (the client filename is never used on disk).
- **`App.jsx` / `main.jsx` (§44)** — a Vite layout; this project uses the
  App Router as specified in §41.
- **Tax direction (§28)** — see "Money and order totals" above; both modes are
  implemented and toggled in Settings.
- **DataGrid** — the CRUD pages use a custom `DataTable` that collapses to cards
  on mobile (required by §52, which DataGrid does not do). MUI X DataGrid is used
  for the inventory transaction ledger, where a dense read-only grid fits.

### The storefront, added after the original spec

§63 excluded a customer-facing storefront; it was added later on request. Two
choices worth flagging, both reversible by an environment variable:

- **Mobile + OTP instead of a password.** Nothing in the existing data model
  stored customer credentials, and the customers the admin had already created
  had none. OTP sign-in works for every existing customer with no migration and
  no credential hand-out, and matches how Indian retail apps sign people in.
  There is no SMS provider — see `OTP_ECHO` above.
- **Masked autofill for a recognised phone number** — see "Recognising a
  returning shopper" above. `STOREFRONT_OPEN_AUTOFILL=true` gives the literal
  fill-from-phone-number behaviour.

Also not wired up: an online payment gateway. Checkout offers the methods enabled
in Settings (cash or UPI on delivery by default) and every online order arrives
unpaid, for staff to mark paid on delivery or collection.

Still not built, by instruction (§63) — the schema leaves room for them:
suppliers, purchase orders, GST invoices, delivery tracking, loyalty, wallet,
WhatsApp, payment gateway, subscriptions, multi-store.

Password reset generates a real token but has no email provider wired up; outside
production the token is returned in the response so the flow can be exercised.
