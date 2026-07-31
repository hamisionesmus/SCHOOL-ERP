# School ERP — Kenyan CBC Multi-Tenant School Management Platform

Cloud-based, multi-tenant SaaS ERP for Kenyan CBC schools (PP1–Grade 9), built incrementally as a
real, working codebase rather than a mockup. See `docs/` for the full design:

- [`docs/SRS.md`](docs/SRS.md) — requirements, full module list, build status per module
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — multi-tenant strategy, stack, phase roadmap
- [`docs/ERD.md`](docs/ERD.md) — data model
- [`docs/RBAC.md`](docs/RBAC.md) — full role list + permission matrix
- [`docs/API.md`](docs/API.md) — endpoint index (live spec at `/api/docs` once running)

This repo is built phase by phase (tracked in `ARCHITECTURE.md` §6), with each phase landing a
working, browser-verified increment rather than stubs. **Phases 1–9 are done** — see "What's built"
below. Mobile apps, AI features, real biometric hardware/ML integration, live payment-gateway
webhooks, and the full test/CI/CD/hardening pass remain planned (Phase 10).

## What's built (Phases 1–9)

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
  from Finance's fee invoices, with its own `TRP-YYYY-NNNN` receipt series, plus a live
  days-until-trip countdown badge on every trip.
- **Analytics dashboard**: `/school` is now a role-aware dashboard (animated stat cards + recharts
  bar/pie/line charts) instead of a plain list — a School Administrator sees student/staff/finance/
  trip stats, a Class Teacher sees their own class's attendance trend, a Parent/Student sees their
  children's attendance/fees/next trip. The Super Admin dashboard got the same stat-card/chart
  treatment.
- **Classes**: every class now has an assignable class teacher of record, managed from a dedicated
  Classes page — this is what activates a teacher's attendance-marking rights (the enforcement
  already existed since Phase 2; there was just no UI to set it until now).
- **UI polish**: toast notifications (`sonner`) and confirm-dialog modals in place of raw inline
  errors and native `confirm()` popups, shimmer skeleton loaders while data is fetched, animated
  count-up stat cards, and a redesigned gradient/glassmorphism login page.
- **Student location + full edit**: a real edit form (previously only photo/UPI/NEMIS/class were
  editable) plus home address/landmark captured via a free Leaflet/OpenStreetMap pin-drop map (no
  paid maps API key anywhere in this repo) — used for transport drop-off, not just record-keeping.
- **Biometric attendance log**: an honest event-log stub — no real face/fingerprint hardware or ML
  matching runs anywhere in this codebase. Staff log a scan (face for learners, fingerprint for
  staff) through a form standing in for what a real device webhook would post in production. Events
  are retained forever (no DELETE route exists in the module); a guardian sees their own children's
  log, a staff member sees their own. A student `OUT` event automatically fires a guardian SMS with a
  static ETA from the route's configured travel time (no live GPS).
- **Colored, filenamed report cards**: the PDF (and the on-screen table) now colors each score green
  or red against an admin-configurable pass mark, and downloads with a real filename
  (`Lastname_Firstname_ExamName_TermN_ReportCard.pdf`) instead of the old generic `report-card.pdf`.
- **Non-teaching staff portal**: every staff member — teaching or not — gets a Payslips tab
  (HR-issued, downloadable PDF; not an automatic payroll engine) and a daily Work Log, both on the
  existing HR page.
- **Kitchen module**: daily stock intake/usage recording with automatic remaining-quantity math —
  deliberately reuses the Inventory module's engine (`category="Kitchen"`) instead of a parallel
  system.
- **Super Admin storage visibility**: a real per-school storage figure (Postgres table sizes + the
  uploads-folder byte size, not an estimate) on the Super Admin dashboard.
- **Backups**: `npm run backup` (in `apps/api`) wraps `pg_dump` + an uploads-folder archive into
  timestamped local files — see `docs/SRS.md` §5 for what's still manual (off-box/cloud upload,
  retention, restore runbook).
- **UI/UX overhaul**: independently-scrolling sidebar and main content pane on every layout (was
  whole-page scroll); a sidebar collapse-to-icon-rail toggle on both the tenant app and the Super
  Admin app, persisted per browser; a computed notification bell (pending leave/admissions/trips/low
  stock/mark-sheet approvals/overdue invoices/own fee balance, each gated by the permission that owns
  it); reusable client-side sort + pagination components, wired into the Super Admin schools list and
  several tenant list pages.
- **Super Admin app**: rebuilt behind its own sidebar shell (Schools, Backups) instead of one flat
  page. Each school now has a detail page with:
  - **Subscription billing** — issue invoices, record payments (bank/M-Pesa/cash), and a payment that
    reaches the invoice amount **automatically reactivates a suspended school** and extends its
    renewal date — no manual re-enable step beyond confirming the payment happened. Invoices/receipts
    are downloadable as PDF and emailed to the school admin (platform email stub — logs instead of
    sending, same pattern as SMS).
  - **Renewal countdown** computed from the tenant's current billing period.
  - **School Administrator password reset** — generates a fresh one-time temporary password. Real
    passwords are never shown to the Super Admin (or anyone) since they're one-way bcrypt hashes; this
    is the honest alternative to "view the admin's password."
  - **Cross-school audit log** viewer.
  - **Backups page** — lists and triggers on-demand database + uploads backups from the UI.
- **Tenant-side billing view**: the School Administrator's own Settings page now shows a read-only
  billing card (renewal countdown, invoice history, PDF downloads) for their school.
- **Unified login**: one login form for every role — no separate "Super Admin" login UI. The backend
  already resolved realm from whether a tenant slug was submitted; the frontend just stopped exposing
  that as a visible choice, folding the tenant-slug field behind an optional "Signing in to a specific
  school?" toggle.
- **Attendance fix**: Parents/Students were being rendered an editable per-student status dropdown
  (the backend already rejected their writes, but the UI implied they could mark attendance) — now a
  read-only status badge for non-markers.

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

On the login page, click "Signing in to a specific school?" to reveal the tenant-slug field and enter
`greenfield-academy`, alongside the email/password above. Leaving the slug field blank and empty
instead logs in as the Super Admin (`SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` from `.env`) — there is
a single login form for both; the backend resolves which realm to authenticate against based on
whether a slug was submitted.

## File uploads

Student photos and school logos are stored locally under `apps/api/uploads/<tenant-schema>/` and
served via Express static assets — an intentional local-disk stub (documented in
`docs/SRS.md` §4.30) that can be swapped for S3/GCS later without changing any call site.

## Requirements

Node 20+, Docker (for Postgres/Redis), npm 10+ (workspaces; no separate package manager needed).
