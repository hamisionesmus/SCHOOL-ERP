# Deployment — Truehost cPanel (myschoolapp.xyz)

Target: shared cPanel hosting (account `cztgoxji`, server `149.56.24.4`, SSH port `21098`).
No Docker/Redis on this plan — neither is used by the app, so that's fine. Postgres and a
persistent Node process (via cPanel's Node.js Selector / Passenger) are both available and are
what this deploy uses.

Layout on the server:

```
~/school-erp/              ← git clone of this repo, kept current via `git pull`
~/school-erp/apps/api/     ← cPanel Node.js App #1 (api.myschoolapp.xyz)
~/school-erp/apps/web/     ← cPanel Node.js App #2 (myschoolapp.xyz)
```

## One-time setup

Run these once, either through cPanel's **Terminal** app (Advanced section, if present) or via
SSH from your own machine using the key already authorized under Security → SSH Access.

### 1. Add the domain

If `myschoolapp.xyz` isn't already the account's primary domain, add it under **Domains → Create
A New Domain** (as an Addon Domain) once DNS has finished propagating to this account.

### 2. Create the `api` subdomain

**Domains → Create A New Domain** → subdomain `api` on `myschoolapp.xyz` → document root can be
anything (the Node.js App config below overrides how requests are actually served).

### 3. Create the Postgres database

**Databases → PostgreSQL Database Wizard**:
- Database name: `schoolerp` (cPanel will prefix it, e.g. `cztgoxji_schoolerp`)
- Create a user, e.g. `erpapp` (becomes `cztgoxji_erpapp`) with a strong generated password
- Grant the user **ALL PRIVILEGES** on the database

Note the full database name, username, and password — you'll need them for `apps/api/.env` in
step 5 (keep that password to yourself; there's no need to send it anywhere else).

### 4. Clone the repo

```bash
cd ~
git clone https://github.com/hamisionesmus/SCHOOL-ERP.git school-erp
```

(Repo is public, no credentials needed to clone.)

### 5. Create the two `.env` files

These are never committed and never touched by deploys — create them once, by hand:

```bash
cp ~/school-erp/apps/api/.env.production.example ~/school-erp/apps/api/.env
nano ~/school-erp/apps/api/.env   # fill in DATABASE_URL, JWT secrets, super admin seed creds

cp ~/school-erp/apps/web/.env.production.example ~/school-erp/apps/web/.env.production.local
```

(the web one only needs `NEXT_PUBLIC_API_URL`, already correct in the example file)

### 6. Set up the two Node.js Apps

**Software → Setup Node.js App → Create Application**, twice:

| | API | Web |
|---|---|---|
| Node version | latest 20.x available | latest 20.x available |
| Application mode | Production | Production |
| Application root | `school-erp/apps/api` | `school-erp/apps/web` |
| Application URL | `api.myschoolapp.xyz` | `myschoolapp.xyz` |
| Application startup file | `dist/main.js` | `server.js` |

After creating each, cPanel shows a line like:

```
source /home/cztgoxji/nodevenv/school-erp/apps/api/20/bin/activate
```

**Copy both of these exact lines** (one for api, one for web) — you'll need them for GitHub
Secrets in the next section.

Then, for each app, click **Run NPM Install** once from the Node.js App page — do **not** use any
"production only" install option; the `prisma` CLI is a devDependency needed at runtime (school
provisioning shells out to it), so it must be installed too.

### 7. Generate Prisma clients, migrate, seed, build (first run only)

Using each app's activation command from step 6:

```bash
source /home/cztgoxji/nodevenv/school-erp/apps/api/20/bin/activate
cd ~/school-erp/apps/api
npm run prisma:generate
npx prisma migrate deploy --schema=prisma/platform/schema.prisma
npm run prisma:seed
npm run build
deactivate
```

```bash
source /home/cztgoxji/nodevenv/school-erp/apps/web/20/bin/activate
cd ~/school-erp/apps/web
npm run build
deactivate
```

Then, back in cPanel's Node.js App page for each app, click **Restart**.

## Ongoing deploys (automatic, on every push to `main`)

`.github/workflows/deploy.yml` handles this: on every push, it builds+typechecks both apps first
(the "confirms the changes" gate), and only if that passes does it SSH into the server, `git
pull`, reinstall, regenerate Prisma clients, run any new migrations (both platform and — via
`prisma:tenant:migrate:all` — every existing school's schema), rebuild, and restart both apps.

It needs these **GitHub repo secrets** (repo → Settings → Secrets and variables → Actions → New
repository secret):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `149.56.24.4` |
| `DEPLOY_PORT` | `21098` |
| `DEPLOY_USER` | `cztgoxji` |
| `DEPLOY_SSH_KEY` | contents of `C:\Users\Administrator\.ssh\school_erp_truehost` (the private key — open that file yourself and paste its contents; not shared here) |
| `API_VENV_ACTIVATE` | the exact `source .../apps/api/20/bin/activate` line from step 6 |
| `WEB_VENV_ACTIVATE` | the exact `source .../apps/web/20/bin/activate` line from step 6 |

Once those are set, every push to `main` deploys automatically — no manual step needed.

## Things this deploy does *not* touch

- The existing SACCO site/domain/database on this same hosting account — separate domain,
  separate Postgres database, separate Node.js Apps, never referenced anywhere in this setup.
- `apps/api/uploads/` and `apps/api/backups/` — gitignored, persist across `git pull` untouched.
- `.env` / `.env.production.local` — gitignored, created once by hand, never overwritten by a deploy.
