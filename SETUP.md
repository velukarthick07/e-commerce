# Installing on a new server

This application installs itself through a web page. You copy the code onto a
server, start it, open it in a browser, and it walks you through the rest:
checking the machine, creating the database, building the tables, and creating
the first administrator.

Once that is done the setup page disappears and cannot be reached again.

---

## 1. What the server needs

The wizard checks all of this for you and will not let you continue until the
blocking items pass — so you do not have to verify any of it by hand. It is
listed here so you know what to install before you start.

| | Needed | Why |
|---|---|---|
| **Node.js** | 20.9 or newer | Next.js 16 will not start on anything older |
| **PostgreSQL** | 13 or newer | Stores everything except uploaded images |
| **Disk space** | ~1 GB free | Product images and the database |
| **Memory** | 1 GB or more | Below this, image processing can fail |

PostgreSQL does **not** have to be on the same machine. A managed database
works — you enter its address during setup and tick *Connect over SSL*.

You also need a PostgreSQL user that is allowed to create a database
(`CREATEDB`), or a database that already exists and is empty. The wizard tells
you which situation you are in before it changes anything.

---

## 2. Install

```bash
# 1. Put the code on the server, then:
npm install          # not --omit=dev: the Prisma CLI creates the tables
npm run build
npm start            # add PORT=8080 to use a different port
```

The console prints something like this:

```
  ┌──────────────────────────────────────────────────────────────┐
  │  This installation has not been set up yet.                  │
  └──────────────────────────────────────────────────────────────┘

  Finish installing at:  http://localhost:3000/setup

  Setup key:             GQVQR-Z2ZBJ-GPYVE-TPC0W
```

Open that address. Every other page redirects to it until setup is finished.

> **Keep the setup key.** You will be asked for it on the database step. It is
> also saved in a file called `.setup-key` next to the code, and it is deleted
> automatically once setup succeeds.

### The four steps

1. **Requirements** — the checks above, run against this machine. Green means
   ready, amber is worth reading but does not block, red must be fixed. Fix
   anything red and press *Check again*.
2. **Database** — host, port, user, password and a database name. Press *Test
   connection* first; it reports the PostgreSQL version and what it will do
   with that database. You cannot continue until a test succeeds.
3. **Store and administrator** — your store's name, and the account you will
   sign in with. This first account is a Super Admin.
4. **Install** — shows you a summary, then does the work: creates the database,
   creates the tables, loads the roles, permissions and default store settings,
   creates your account, and writes `.env`.

Then sign in. Everything else — products, categories, staff accounts, tax,
delivery charges, payment methods — is configured inside the application.

### Why it asks for a key

While setup is unfinished, `/setup` will create an administrator account for
whoever asks. If the server is reachable from the internet during that window,
a stranger could get there first. The key is proof that you can read this
server's console or its files.

On a machine nobody else can reach, you can skip it by setting
`SETUP_REQUIRE_KEY=false` in the environment before starting.

---

## 3. What setup writes

| File | Contents |
|---|---|
| `.env` | Database URL, a freshly generated `JWT_SECRET`, and defaults for uploads and the storefront. Created with `600` permissions because it holds both secrets. |
| `.setup-complete.json` | The marker that closes the wizard. Records when setup ran, against which database, and for which administrator. |
| `uploads/` | Where product images are stored. |

If `.env` already exists, setup keeps everything in it and only fills in what
is missing — your own settings and comments survive.

None of these three are in version control, because they are specific to one
installation.

---

## 4. Running it again

The wizard reappears only if `.setup-complete.json` is missing **and** the
database it points at has no user accounts.

```bash
npm run setup:reset   # removes the marker, changes no data
```

Restart the server afterwards. If the database still contains accounts, the
application notices at startup and closes the wizard again — this is deliberate.
To genuinely start over, point setup at a different database, or drop the
existing one first.

---

## 5. Upgrading a store that is already running

Nothing to do. On the first start after the upgrade, the application checks the
database it is already configured for, finds the existing accounts, records
that it is installed, and carries on. It logs:

```
[setup] Existing installation detected (fmcg_admin); the setup wizard is disabled.
```

Your customers never see a setup page.

---

## 6. Installing without a browser

The wizard is the supported path, but nothing depends on it. The same result,
by hand:

```bash
cp .env.example .env
# edit DATABASE_URL, and set JWT_SECRET to `openssl rand -hex 32`

createdb fmcg_admin          # or let your provider create it
npm run db:deploy            # creates the tables
npm run db:seed              # roles, permissions, settings + demo catalogue
```

`db:seed` also loads a demo catalogue and sample orders, which the wizard
deliberately does not — it is meant for evaluating the application, not for a
real store. It creates its own demo sign-in accounts and prints them.

Afterwards, either run the app once so it detects the installation, or create
`.setup-complete.json` yourself:

```bash
echo '{"completedAt":"'"$(date -Iseconds)"'","database":"fmcg_admin","adminEmail":"you@example.com","version":"manual"}' > .setup-complete.json
```

---

## 7. When something goes wrong

**"Nothing is accepting connections at that address."**
PostgreSQL is not running, or not on that port. `sudo systemctl status postgresql`.

**"The password was not accepted for that user."**
Check the password. If you are certain it is right, PostgreSQL may be
configured for `peer` authentication on local connections — use `127.0.0.1`
instead of `localhost`, or set `md5`/`scram-sha-256` in `pg_hba.conf`.

**"That user is not allowed to connect from this machine."**
`pg_hba.conf` does not have a rule for this client. Add one and reload
PostgreSQL.

**"… does not exist and … is not allowed to create databases."**
Either grant it — `ALTER ROLE myuser CREATEDB;` — or create the database
yourself and enter its name.

**"… already contains an installation with N user accounts."**
That database is already in use by this application. Sign in to it instead, or
choose a different name. Setup will not write over it.

**"The Prisma CLI is not installed, so the tables cannot be created."**
The CLI is a development dependency and `npm install --omit=dev` skips it. Run
a plain `npm install`.

**The page says the connection ended before setup finished.**
Check the server console. If setup actually completed, reloading the page will
send you to the sign-in screen.

---

## 8. Before opening it to the public

- Finish setup first. The window in which `/setup` is open is the window in
  which someone else could install over you.
- Put it behind HTTPS. Session cookies are marked `Secure` in production and
  browsers will not send them over plain HTTP.
- Set `OTP_ECHO=false` and implement `deliverOtp` in `src/lib/otp.ts`, or
  storefront sign-in codes will keep being returned in the API response.
- Set `APP_URL` and `CLIENT_URL` to the address customers actually use; they
  appear in password-reset links.
- Back up `.env`. The `JWT_SECRET` in it signs every session — losing it signs
  everyone out; leaking it lets anyone forge a session.
