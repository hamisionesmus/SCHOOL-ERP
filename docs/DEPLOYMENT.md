# Deployment — VPS with Docker

Target: a plain Ubuntu 22.04 VPS with root access (no shared-hosting control panel). Everything
runs in Docker: PostgreSQL, the NestJS API, the Next.js web app, and Caddy as a reverse proxy that
also handles HTTPS automatically (Let's Encrypt, zero manual certbot config).

## One-time server setup

Run these once over SSH as root (or a sudo user).

### 1. Point DNS at the server

Both `myschoolapp.xyz` and `api.myschoolapp.xyz` need an A record pointing at the VPS's IP
address. Caddy needs this to already be correct before it can issue certificates.

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### 3. Clone the repo

```bash
cd ~
git clone https://github.com/hamisionesmus/SCHOOL-ERP.git school-erp
cd school-erp
```

(Repo is public, no credentials needed to clone.)

### 4. Create the `.env` file

```bash
cp .env.production.example .env
nano .env
```

Fill in: a Postgres password, two JWT secrets (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` run twice), and the Super Admin seed email/password. `NEXT_PUBLIC_API_URL` is already correct in the template.

### 5. Bring everything up

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run builds both images (a few minutes), starts Postgres, and the API's
`docker-entrypoint.sh` automatically applies all platform migrations before the server starts —
no separate migrate step needed. Caddy will request Let's Encrypt certificates for both domains
automatically once it can reach them on ports 80/443.

Check everything's healthy:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

### 6. Seed the Super Admin (first run only)

```bash
docker compose -f docker-compose.prod.yml exec api npm run prisma:seed
```

That's it — `https://myschoolapp.xyz` and `https://api.myschoolapp.xyz/api/docs` should now be
live with valid HTTPS certificates.

## Ongoing deploys (automatic, on every push to `main`)

`.github/workflows/deploy.yml` handles this: on every push, it builds+typechecks both apps first
(the "confirms the changes" gate), and only if that passes does it SSH into the server, `git
pull`, and run `docker compose up -d --build` — which rebuilds only what changed and recreates
those containers. The API container's entrypoint re-applies migrations (platform + every existing
school's tenant schema) on every restart, so schema changes deploy automatically too.

It needs these **GitHub repo secrets** (repo → Settings → Secrets and variables → Actions → New
repository secret):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | the VPS's IP address |
| `DEPLOY_PORT` | SSH port (22 unless changed) |
| `DEPLOY_USER` | `root` (or whichever user has Docker access) |
| `DEPLOY_SSH_KEY` | contents of `C:\Users\Administrator\.ssh\school_erp_truehost` (the private key — open that file yourself and paste its contents; not shared here) |

Once those are set, every push to `main` deploys automatically — no manual step needed.

## Things this deploy does *not* touch

- `postgres_data`, `api_uploads`, `api_backups` — named Docker volumes, persist across
  `docker compose up` and image rebuilds; only removed by an explicit `docker compose down -v`.
- `.env` at the repo root — gitignored, created once by hand, never overwritten by a deploy.
