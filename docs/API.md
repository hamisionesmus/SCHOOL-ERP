# API Overview

Full interactive spec is auto-generated from the NestJS controllers via `@nestjs/swagger` and served
at `http://localhost:4000/api/docs` once the API is running. This document is a human-readable index
of what exists in Phase 1 and the near-term additions; it is not hand-maintained to stay in sync with
every field — treat Swagger as authoritative for request/response shapes.

## Conventions

- Base URL: `http://localhost:4000` (dev)
- All tenant-scoped routes require `Authorization: Bearer <accessToken>`; the JWT carries the
  resolved tenant schema, so there is no `tenantId` in the URL or body for these routes.
- Platform routes (`/platform/*`) require a Super Admin JWT and operate on the `public` schema.
- Errors: `{ statusCode, message, error }` (Nest's default `HttpException` shape).
- Pagination: `?page=1&pageSize=20` → `{ data: [...], meta: { page, pageSize, total } }`.

## Phase 1 endpoints (built)

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | `{ refreshToken }` → new token pair (rotates refresh token) |
| POST | `/auth/logout` | Invalidates the presented refresh token |
| GET | `/auth/me` | Current user + roles + effective permissions |

### Platform (Super Admin only)
| Method | Path | Notes |
|---|---|---|
| POST | `/platform/tenants` | Creates a school: provisions Postgres schema, runs migrations, seeds roles + first School Administrator |
| GET | `/platform/tenants` | List all schools, paginated, with status/usage summary |
| GET | `/platform/tenants/:id` | Tenant detail |
| GET | `/platform/tenants/:id/usage` | Real storage usage — sums `pg_total_relation_size` across the tenant's Postgres schema plus the uploads-folder byte size (Phase 8) |
| PATCH | `/platform/tenants/:id/suspend` | Sets status = SUSPENDED (blocks tenant-scoped logins) |
| PATCH | `/platform/tenants/:id/activate` | Sets status = ACTIVE |
| GET | `/platform/subscription-plans` | List plans |

### Tenant-scoped: Users & Roles
| Method | Path | Notes |
|---|---|---|
| GET | `/users` | List users in current tenant (requires `TENANT:MANAGE_USERS`) |
| POST | `/users` | Create a staff/parent/student user + assign role(s) |
| GET | `/roles` | List roles + permissions for current tenant |

### Tenant-scoped: Academics core
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/academic-years` | Manage academic years, mark current |
| GET/POST | `/grade-levels` | PP1–Grade 9 configuration |
| GET/POST | `/classes` | Classes/streams, assign class teacher on creation |
| PATCH | `/classes/:id` | Reassign (or unassign with `classTeacherId: null`) a class's class teacher — `TENANT:MANAGE_USERS` |

### Tenant-scoped: Dashboard (Phase 7)
| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Role-scoped stat/chart sections (school/finance/myClass/trips/own), each computed only if the caller's permissions warrant it — no blanket permission requirement |

### Tenant-scoped: Students
| Method | Path | Notes |
|---|---|---|
| GET | `/students` | List/search (requires appropriate permission; Parent role auto-scoped to own children) |
| POST | `/students` | Create student + admission number generation |
| GET | `/students/:id` | Full profile |
| PATCH | `/students/:id` | Update (audited) — as of Phase 8 covers name/DOB/gender/grade/address/landmark/latitude/longitude, not just photo/UPI/NEMIS/class |

### Tenant-scoped: Biometric log (Phase 8)
| Method | Path | Notes |
|---|---|---|
| GET | `/biometric-events` | Scoped by permission: `BIOMETRIC:MANAGE` sees all, a guardian sees their children's, a staff member sees their own |
| POST | `/biometric-events` | Logs a scan — `BIOMETRIC:MANAGE`. Stands in for a real device webhook; a STUDENT `OUT` event fires the departure SMS |
| PATCH | `/biometric-events/:id/archive` | Soft-archives an event — `BIOMETRIC:MANAGE`. No DELETE route exists anywhere in this module |

### Tenant-scoped: HR — Payslips & Work Log (Phase 8)
| Method | Path | Notes |
|---|---|---|
| GET | `/hr/payslips` | `HR:EDIT` sees all, a staff member sees only their own |
| POST | `/hr/payslips` | Issues/updates a payslip for a (staff, month, year) — `HR:EDIT`. `netPay` computed server-side |
| GET | `/hr/payslips/:id/pdf` | Downloadable payslip PDF — the owning staff member or `HR:EDIT` |
| GET/POST | `/hr/work-logs` | Self-service daily work log; POST upserts on (staff, date) |

## Endpoint groups landed since (by phase — see `docs/ARCHITECTURE.md`)

Phases 2–8 are done; the endpoints below are all live, not planned. Full request/response shapes live
in Swagger (`/api/docs`), not repeated here.

- `/admissions/*`, `/attendance/*`, `/homework/*` — Phase 2
- `/exams/*`, `/cbc/*`, `/exams/:examId/report-card/*` — Phase 3
- `/finance/*`, `/communications/*` — Phase 4
- `/transport/*`, `/library/*`, `/inventory/*`, `/hr/*`, `/health/*`, `/discipline/*` — Phase 5
- `/uploads`, `/settings`, `/trips/*`, `/platform/tenants/:id/payment-config` — Phase 6
- `/dashboard`, `/classes/:id` (PATCH) — Phase 7
- `/biometric-events/*`, `/hr/payslips/*`, `/hr/work-logs`, `/inventory/items?category=` (Kitchen
  filter), `/platform/tenants/:id/usage` — Phase 8
- `/notifications`, `/platform/tenants/:id/invoices`, `/platform/invoices/:id/payments`,
  `/platform/invoices/:id/pdf`, `/platform/tenants/:id/reset-admin-password`,
  `/platform/tenants/:id/audit-logs`, `/platform/backups`, `/platform/backups/run`,
  `/settings/billing`, `/settings/billing/:invoiceId/pdf` — Phase 9 (see table below)

### Tenant-scoped: Notifications (Phase 9)
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | Computed feed, no dedicated permission gate — any authenticated tenant user; items are individually gated by the permission that owns each underlying module (leave, admissions, trips, low stock, mark-sheet approval, overdue invoices, own fee balance/upcoming trip) |

### Platform: Billing, password reset, audit logs (Super Admin only, Phase 9)
| Method | Path | Notes |
|---|---|---|
| POST | `/platform/tenants/:id/invoices` | Issues a `PlatformInvoice`; emails the school admin via the platform `EmailProvider` stub (logs instead of sending) |
| GET | `/platform/tenants/:id/invoices` | List invoices for a tenant |
| POST | `/platform/invoices/:invoiceId/payments` | Records a `PlatformPayment`; if cumulative payments reach the invoice amount, marks it PAID, extends `Tenant.currentPeriodEnd`, and reactivates a SUSPENDED tenant — atomically, regardless of payment method |
| GET | `/platform/invoices/:invoiceId/pdf` | Downloadable invoice/receipt PDF |
| POST | `/platform/tenants/:id/reset-admin-password` | Generates and sets a fresh temporary password for the tenant's School Administrator, returned exactly once in the response — real passwords are never retrievable or displayed |
| GET | `/platform/tenants/:id/audit-logs` | Reads the tenant's own `AuditLog` table by schema name (cross-schema read from the platform layer) |
| GET | `/platform/backups` | Lists backup files (database dumps + uploads archives) on disk |
| POST | `/platform/backups/run` | Triggers `prisma/backup-database.ts` in the background |

### Tenant-scoped: Billing view (Phase 9)
| Method | Path | Notes |
|---|---|---|
| GET | `/settings/billing` | `SETTINGS:MANAGE` — the School Administrator's own read-only view of `billingCycle`/`currentPeriodEnd`/invoices/payments |
| GET | `/settings/billing/:invoiceId/pdf` | `SETTINGS:MANAGE` — same PDF renderer as the Super Admin route, with a cross-tenant-access check |

## Planned endpoint groups (by phase — see `docs/ARCHITECTURE.md`)

- `/ai/*`, real biometric device/ML integration (Phase 8 shipped the event-log data model + a manual
  logging endpoint, not real hardware), live M-Pesa/bank payment-gateway webhooks (Phase 9 shipped
  manual-confirm payment recording, not automatic callbacks) — Phase 10

## OpenAPI/Swagger

`apps/api/src/main.ts` wires `SwaggerModule` with bearer-auth security scheme, tagging controllers by
module. Run the API and visit `/api/docs` for the live, always-current spec; export via
`/api/docs-json` for Postman/Insomnia import.
