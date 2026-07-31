# System Architecture

## 1. High-level component diagram

```mermaid
flowchart LR
    subgraph Clients
        Web["Next.js Web App\n(Super Admin / School / Portals)"]
        Mobile["Mobile Apps (Expo)\nTeacher / Parent / Student / Driver / Security"]
    end

    subgraph Edge
        LB["NGINX / Load Balancer\nTLS termination"]
    end

    subgraph API_Layer["NestJS API"]
        Auth["Auth Module\nJWT + Refresh + 2FA"]
        Tenancy["Tenant Resolution Middleware"]
        RBAC["RBAC Guards"]
        Modules["Feature Modules\n(SIS, Academics, Finance, ...)"]
        Queue["BullMQ Workers\n(SMS, Reports, Biometric events)"]
    end

    subgraph Data
        PG[("PostgreSQL\nschema-per-tenant")]
        Redis[("Redis\ncache + queues + sessions")]
        S3[("S3-compatible Object Storage\ndocuments/photos")]
    end

    subgraph External
        SMSProv["SMS Providers\nAfrica's Talking / Twilio / Safaricom"]
        MPesa["M-Pesa Daraja API"]
        Biometric["Biometric Devices / Edge Gateway"]
    end

    Web --> LB --> API_Layer
    Mobile --> LB
    Auth --> Tenancy --> RBAC --> Modules
    Modules --> PG
    Modules --> S3
    Modules --> Queue
    Queue --> Redis
    Queue --> SMSProv
    Modules --> MPesa
    Biometric --> Queue
```

## 2. Multi-tenant strategy: schema-per-tenant

**Why not database-per-tenant?** True isolation, but at 100+ schools it multiplies connections,
migrations, and ops overhead (each DB needs its own connection pool, backup job, monitoring).

**Why not a shared table with `tenant_id` column?** Cheapest to build, but one missing `WHERE
tenant_id = ?` clause anywhere in the codebase leaks another school's data. Given the explicit "no
school should ever access another school's data" requirement, this risk is unacceptable for this
domain (student PII, medical data, exam records).

**Chosen: schema-per-tenant in a single PostgreSQL cluster.**
- Each tenant gets its own Postgres schema (`tenant_<slug>`), created by running the same Prisma
  migration set against it at tenant-creation time.
- A request-scoped `TenantContextService` resolves the tenant (from JWT claim, set at login) and the
  Prisma client sets `search_path` to that tenant's schema for the duration of the request — so
  every query in feature-module code is automatically tenant-scoped without each query needing to
  remember a `tenant_id` filter. There is structurally no way for a query to reach another schema
  unless it explicitly qualifies a table name with another schema (never done in application code).
- Platform-level data (tenants list, subscription plans, Super Admin users) lives in `public`, which
  ordinary tenant-scoped requests never touch.
- Trade-off accepted: single Postgres instance is a shared blast radius for infra-level incidents
  (not app-level data leakage) — mitigated by standard Postgres HA/backup practice, out of scope for
  app code.

## 3. Request flow (tenant-scoped request)

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Tenant Middleware
    participant G as JWT/RBAC Guard
    participant P as PrismaService (search_path=tenant_x)
    participant DB as Postgres

    C->>MW: HTTP request + Bearer JWT
    MW->>MW: decode JWT -> tenantSchema claim
    MW->>P: bind request-scoped client to tenant schema
    MW->>G: next()
    G->>G: check role/permission for route
    alt authorized
        G->>P: query
        P->>DB: SET search_path TO tenant_x; SELECT ...
        DB-->>P: rows (tenant_x only)
        P-->>C: response
    else unauthorized
        G-->>C: 403 Forbidden
    end
```

## 4. Auth model

- Passwords hashed with bcrypt (cost 12).
- Login issues a short-lived access JWT (15 min default) and a longer-lived refresh token (7 days,
  stored hashed, rotated on use).
- JWT claims: `sub` (user id), `tenantSchema` (or `null`/`"public"` for platform users), `roles`.
- 2FA: TOTP secret field + `twoFactorEnabled` flag scaffolded on `User`/`PlatformUser`; enforcement
  wired when the first admin-facing settings UI ships (Phase 2).
- RBAC: `@RequirePermission('MODULE:ACTION')` decorator + a guard that checks the JWT's resolved
  roles against the tenant's `RolePermission` rows — server-side on every request, never trusted from
  the client.

## 5. Tech stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TS + Tailwind + shadcn/ui | SSR for fast first load on modest school-network bandwidth, component quality bar matching Linear/Stripe-style UI ask |
| Data fetching | React Query | Caching, background refetch, optimistic updates for dashboards |
| Forms | React Hook Form + Zod | Type-safe validation shared with backend DTOs via `packages/shared` |
| Backend | NestJS | Opinionated module/DI structure scales better than plain Express for a 20+ module ERP; first-class Swagger, guards, interceptors |
| ORM | Prisma | Type-safe, first-class multi-schema migration support, good DX for a large evolving schema |
| DB | PostgreSQL 16 | JSONB for flexible CBC rubric/competency data, strong relational integrity for finance |
| Cache/Queue | Redis + BullMQ | SMS/report/biometric-event processing off the request path |
| Object storage | S3-compatible (MinIO locally, AWS S3/DO Spaces in prod) | Documents, photos, biometric refs |
| Auth | JWT + refresh, bcrypt, TOTP | Stateless horizontal scaling, standard 2FA |
| Infra | Docker Compose (dev) → Kubernetes (prod, Phase 9) | Reproducible local dev now, documented scale-out path |

## 6. Phase roadmap (source of truth: `C:\Users\Administrator\.claude\plans\dynamic-coalescing-deer.md`)

1. **Phase 0/1 (done)** — Docs + monorepo foundation: auth, tenants, RBAC skeleton, Super Admin
   school creation, minimal web shell.
2. **Phase 2 (done)** — Admissions (application → interview/offer/reject/waitlist → admit), Attendance
   (mark/lock/reopen with class-teacher-of-record enforcement), Homework (assign/submit), guardian
   linking, and real Class Teacher/Parent/School Administrator UI (tabs gated by permission).
3. **Phase 3 (done)** — Subjects + teacher subject-assignments, Exams/ExamSubjects with a
   DRAFT→SUBMITTED→APPROVED workflow (submit by the assigned teacher, approve/reject by
   EXAM:APPROVE, reopen by EXAM:REOPEN), numeric or CBC-rubric (EE/ME/AE/BE) scoring per
   exam-subject, and per-student report cards that only ever surface APPROVED marks.
4. **Phase 4 (done)** — Finance: fee structures → bulk invoice generation, payments with receipt
   numbering and denormalized balance tracking, M-Pesa STK push as a documented stub. Communications:
   provider-agnostic SmsProvider (stub implementation), manual announcements (class → guardians),
   automatic payment-receipt SMS.
5. **Phase 5 (done)** — Transport (vehicles/routes/student assignment), Library (catalogue/loans/
   fines), Inventory (items/stock movements, staff-only), Health (medical alerts/clinic visits),
   Discipline (cases with automatic guardian SMS), HR (leave request/approval self-service). Kitchen
   and full payroll/GL remain planned — see docs/SRS.md §4.19–4.22.
6. **Phase 6 (done)** — UX depth and cross-module polish rather than a new module: a permission-gated
   sidebar app shell replacing the old top-nav across all `/school/*` pages; a tenant-scoped Settings
   module so a School Administrator can self-serve branding (logo, mission/vision/motto, colors,
   address/SMS sender ID), with payment/banking config (M-Pesa paybill, bank details) kept
   Super-Admin-only per tenant; a local-disk file-upload stub (`UploadsModule`, swappable for S3 later,
   mirroring the `SmsProvider` abstraction pattern) used for student photos and the school logo;
   server-rendered branded PDF report cards (`pdfkit`) that pull the school's logo/mission/vision and
   the student's photo into a downloadable document; and a full Trips workflow on top of Transport —
   a Class Teacher proposes a trip, a School Administrator approves/rejects it (broadcasting an SMS to
   every guardian on approval), and a Parent registers a child and pays the exact per-student cost
   through a trip-scoped ledger separate from the Finance `Invoice`/`Payment` tables, with its own
   `TRP-YYYY-NNNN` receipt series and a payment-confirmation SMS.
7. **Phase 7 (done)** — Analytics dashboards and remaining cross-module UX depth. A role-scoped
   `GET /dashboard` endpoint (`DashboardModule`) computes stat/chart sections conditionally by
   permission, exactly mirroring the "server decides what's included" scoping pattern used by
   `StudentsService.list()` since Phase 1 — a School Administrator (who holds nearly every permission)
   sees a school-wide section (student/gender/grade counts, staff-by-role), a finance section
   (revenue/outstanding/collection rate), and a trips section; a Class Teacher sees only their own
   class's attendance stats; a Parent/Student sees only their own children's attendance/fee/trip data.
   The `/school` route became this dashboard (Students moved to `/school/students`); charts render via
   `recharts` (bar/pie/line). Every class now has an assignable class teacher of record via
   `PATCH /classes/:id` and a dedicated Classes management page — this is what actually activates a
   teacher's attendance-marking rights, since `AttendanceService` already enforced `classTeacherId`
   from Phase 2 but there was previously no UI to set it. Trips gained a live days-until-trip countdown
   badge (computed client-side from `tripDate`, shown to teachers/admins/parents alike). A UI polish
   pass added toast notifications (`sonner`) and "sweet alert"-style confirm dialogs in place of raw
   inline errors and native `confirm()` calls, shimmer skeleton loaders in place of "Loading..." text,
   animated stat cards, and a redesigned login page — built on the existing Tailwind/hand-rolled
   component system rather than adopting the MUI component library, since swapping component systems
   mid-project across 15+ existing pages would be a much larger, riskier rewrite for the same visual
   outcome.
8. **Phase 8** — Mobile apps, biometric device integration layer, AI features (originally scoped as
   Phase 6 in the source requirements; renumbered twice as Phase 6 and Phase 7 were each redirected
   toward UX work at the user's request).
9. **Phase 9** — Test suites, CI/CD, Kubernetes, manuals, security hardening pass.

## 7. Security posture at each phase

Phase 1 ships: hashed passwords, JWT + refresh rotation, server-side RBAC checks, tenant isolation by
construction, soft deletes, audit log for auth/tenant/user mutations. Rate limiting, full 2FA
enforcement, GDPR/Kenya DPA request handling, and a formal pen-test pass are tracked for Phase 9 and
should not be assumed present before then.
