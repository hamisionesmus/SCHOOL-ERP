# School ERP — Kenyan CBC Multi-Tenant School Management Platform

Cloud-based, multi-tenant SaaS ERP for Kenyan CBC schools (PP1–Grade 9), built incrementally as a
real, working codebase rather than a mockup. See `docs/` for the full design:

- [`docs/SRS.md`](docs/SRS.md) — requirements, full module list, build status per module
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — multi-tenant strategy, stack, phase roadmap
- [`docs/ERD.md`](docs/ERD.md) — data model
- [`docs/RBAC.md`](docs/RBAC.md) — full role list + permission matrix
- [`docs/API.md`](docs/API.md) — endpoint index (live spec at `/api/docs` once running)

This repo is built phase by phase (tracked in `ARCHITECTURE.md` §6), with each phase landing a
working, browser-verified increment rather than stubs. **Phases 1–6 are done** — see "What's built"
below. Mobile apps, biometric attendance, AI features, and the full test/CI/CD/hardening pass remain
planned (Phases 7–8).

## What's built (Phases 1–6)

- **Platform**: Super Admin creates/suspends/activates schools; each school gets its own isolated
  Postgres schema, provisioned automatically via `prisma migrate deploy`.
- **Auth & RBAC**: JWT access/refresh, permission-based guards (`MODULE:ACTION` codes), a
  permission-gated sidebar so every role only sees the modules it can use.
- **Student Information System**: student records, guardian linking, photo upload, admissions
  pipeline (application → interview/offer/reject/waitlist → admit).
- **Attendance**: per-day register, class-teacher-of-record enforcement, lock/reopen with audit.
- **Examinations / CBC**: subjects, teacher subject-assignments, exams with a
  draft→submitted→approved workflow, numeric or CBC rubric (EE/ME/AE/BE) scoring, and a
  **downloadable branded PDF report card** (school logo/mission/vision/motto + student photo + marks).
- **Finance**: fee structures, bulk invoicing, payments with receipt numbering, M-Pesa STK push
  (documented stub — no real Daraja credentials in this environment).
- **Communications**: provider-agnostic SMS abstraction (stub logs instead of calling a real
  gateway), manual announcements, automatic receipt/discipline/trip SMS.
- **Transport, Library, Inventory, Health, Discipline, HR leave** — see `docs/SRS.md` §4.11–4.23 for
  exactly what's built vs. planned in each.
- **School Settings**: School Administrator self-service branding (logo, colors, mission/vision/
  motto, address, SMS sender ID) that flows through to report cards and the app header. Payment/
  banking config (M-Pesa paybill, bank details) is kept Super-Admin-only per school.
- **Trips**: a Class Teacher proposes a one-off school trip, a School Administrator approves or
  rejects it (broadcasting an SMS to every guardian on approval), and a Parent registers their child
  and pays the exact per-student cost, receiving a receipt and confirmation SMS. A separate ledger
  from Finance's fee invoices, with its own `TRP-YYYY-NNNN` receipt series.

## Monorepo layout

```
apps/
  api/        NestJS backend (Prisma + PostgreSQL, schema-per-tenant)
  web/        Next.js frontend
packages/
  shared/     Shared TypeScript types + permission constants
docs/         SRS, ERD, architecture, RBAC, API docs
```

## Getting started (local dev)

```bash
cp .env.example .env
docker compose up -d          # Postgres + Redis
npm install
npm run db:migrate            # applies Prisma migrations to the `public` schema
npm run db:seed               # creates the Super Admin user
npm run dev                   # starts API (:4000) and Web (:3000)
```

- API: http://localhost:4000 — Swagger docs at `/api/docs`
- Web: http://localhost:3000
- Log in as Super Admin with the credentials from `.env` (`SUPER_ADMIN_EMAIL` /
  `SUPER_ADMIN_PASSWORD`), then create your first school from the Super Admin dashboard.

### Demo tenant

A demo school (`greenfield-academy`) with sample students, classes, exams, invoices, and trips is
seeded by the `apps/api/prisma/seed-phase*-demo.ts` scripts (run once via `ts-node` after the tenant
exists — see each script's header comment). Demo logins, all password `ChangeMe123!`, tenant slug
`greenfield-academy`:

| Role | Email | Notes |
|---|---|---|
| School Administrator | `admin@greenfield.ac.ke` | Jane Wanjiru — full tenant admin, Settings, trip approval |
| Class Teacher | `teacher@greenfield.ac.ke` | Peter Otieno — attendance, marks entry, trip proposals |
| Parent | `parent@greenfield.ac.ke` | Mary Mwangi — guardian of student John Mwangi |

Use the "Sign in to a school instead" link on the login page (as opposed to the Super Admin sign-in)
and enter the tenant slug above.

## File uploads

Student photos and school logos are stored locally under `apps/api/uploads/<tenant-schema>/` and
served via Express static assets — an intentional local-disk stub (documented in
`docs/SRS.md` §4.30) that can be swapped for S3/GCS later without changing any call site.

## Requirements

Node 20+, Docker (for Postgres/Redis), npm 10+ (workspaces; no separate package manager needed).
