# Deployment — VPS with Docker

Target: a plain Ubuntu 22.04 VPS with root access (no shared-hosting control panel). Everything
runs in Docker: PostgreSQL, the NestJS API, the Next.js web app, and Caddy as a reverse proxy that
also handles HTTPS automatically (Let's Encrypt, zero manual certbot config).

**Status:** live in production at https://myschoolapp.xyz (verified 2026-08-01). Auto-deploy on
push to `main` via GitHub Actions is configured — see "Ongoing deploys" below.

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

Fill in: a Postgres password, two JWT secrets (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` run twice), and the Super Admin seed email/password. `NEXT_PUBLIC_API_URL` and `WEB_ORIGIN` are already correct in the template — `WEB_ORIGIN` matters even without the rest of this section filled in, since it's what builds the login link in every outbound email.

The M-Pesa/Advanta block is optional at first boot — leave either blank and the app falls back to
logging instead of sending (see `StubSmsProvider`), so the app still runs. Fill them in to make
school-activation payments and notifications real:

- **M-Pesa (Daraja)** — from a Safaricom Daraja app's "Lipa Na M-Pesa Online" credentials.
  `MPESA_CALLBACK_URL` must be reachable from the internet — the template value
  (`https://api.myschoolapp.xyz/public/activation/mpesa-callback`) is already correct as long as
  that domain resolves to this server. Register the same callback URL in the Daraja app config on
  Safaricom's developer portal.
- **Advanta SMS** — partner ID + API key from [developers.advantasms.com](https://developers.advantasms.com) (Partners page → toggle API → generate key).

### Email

Outbound platform email (activation links, OTP codes, payment confirmations) goes through a
self-hosted Postfix relay — the `postfix` service in `docker-compose.prod.yml`
([boky/postfix](https://github.com/bokysan/docker-postfix)), reachable only inside the docker
network as `postfix:25`. No third-party account or API key needed, but — unlike a managed ESP —
deliverability depends entirely on this server's own reputation, which needs two DNS pieces before
mail reliably lands in an inbox instead of spam (or gets rejected outright).

The relay signs mail as `hamzonetechnologies.com`, not `myschoolapp.xyz` — `myschoolapp.xyz`'s own
DNS zone was found deprovisioned on the DNS host's end when this was first set up, so the platform
operator's own domain (which had a live, editable zone) was used instead. If `myschoolapp.xyz`'s
zone gets reactivated later, switch `ALLOWED_SENDER_DOMAINS`/`HOSTNAME` on the `postfix` service and
`SMTP_FROM_ADDRESS` back — nothing else needs to change.

1. **DKIM.** The relay auto-generates a keypair on first boot and signs every outbound message.
   Read the public key out of the running container and add it as a DNS TXT record:
   ```bash
   docker compose -f docker-compose.prod.yml exec postfix cat /etc/opendkim/keys/hamzonetechnologies.com.txt
   ```
   That prints the `mail._domainkey.hamzonetechnologies.com` TXT record split across quoted chunks
   (standard BIND-zone-file format) — concatenate the `p=...` parts into one string when adding it
   to a DNS panel that wants a single value rather than the split form.
2. **PTR (reverse DNS) for the VPS's own IP.** This is set by whoever controls the IP allocation —
   your VPS/hosting provider, not your domain's DNS zone — usually via a support ticket or an rDNS
   field in their control panel. Ask for the VPS's IP to reverse-resolve to
   `relay.hamzonetechnologies.com` (matching the `HOSTNAME` set on the `postfix` service — "relay",
   not "mail", since `hamzonetechnologies.com` already has a `mail` CNAME that an A record can't
   coexist with), and add a matching forward A record for `relay.hamzonetechnologies.com` → the
   VPS's IP in the domain's own zone (forward-confirmed rDNS — both directions should agree).
   Without the PTR, most major providers (Gmail, Outlook) silently drop or spam-box the mail
   regardless of DKIM being correct.

You'll also want the existing SPF TXT record on `hamzonetechnologies.com` to explicitly authorize
this server's IP (`ip4:<vps-ip>`) alongside whatever's already there, and `SMTP_FROM_ADDRESS` in
`.env` set to something like `School ERP <noreply@hamzonetechnologies.com>`.

Sanity-check the relay itself (independent of DNS) by sending straight through it once it's up:
```bash
docker compose -f docker-compose.prod.yml exec api node -e "require('nodemailer').createTransport({host:'postfix',port:25}).sendMail({from:process.env.SMTP_FROM_ADDRESS,to:'YOUR_TEST_ADDRESS',subject:'test',text:'hello'}).then(r=>console.log(r)).catch(e=>console.error(e))"
```
A successful queue-accept here just proves the relay works — actual inbox delivery still depends
on the DKIM/PTR/SPF records above being in place.

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

- `postgres_data`, `api_uploads`, `api_backups`, `postfix_dkim` — named Docker volumes, persist
  across `docker compose up` and image rebuilds; only removed by an explicit `docker compose down
  -v`. `postfix_dkim` matters especially — losing it means a new DKIM keypair gets generated on
  next boot, invalidating whatever DKIM DNS record you'd already added.
- `.env` at the repo root — gitignored, created once by hand, never overwritten by a deploy.
