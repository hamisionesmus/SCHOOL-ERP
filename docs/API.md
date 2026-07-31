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
| PATCH | `/students/:id` | Update (audited) |

## Endpoint groups landed since (by phase — see `docs/ARCHITECTURE.md`)

Phases 2–7 are done; the endpoints below are all live, not planned. Full request/response shapes live
in Swagger (`/api/docs`), not repeated here.

- `/admissions/*`, `/attendance/*`, `/homework/*` — Phase 2
- `/exams/*`, `/cbc/*`, `/exams/:examId/report-card/*` — Phase 3
- `/finance/*`, `/communications/*` — Phase 4
- `/transport/*`, `/library/*`, `/inventory/*`, `/hr/*`, `/health/*`, `/discipline/*` — Phase 5
- `/uploads`, `/settings`, `/trips/*`, `/platform/tenants/:id/payment-config` — Phase 6
- `/dashboard`, `/classes/:id` (PATCH) — Phase 7

## Planned endpoint groups (by phase — see `docs/ARCHITECTURE.md`)

- `/attendance/biometric-events` (device webhook), `/ai/*` — Phase 8

## OpenAPI/Swagger

`apps/api/src/main.ts` wires `SwaggerModule` with bearer-auth security scheme, tagging controllers by
module. Run the API and visit `/api/docs` for the live, always-current spec; export via
`/api/docs-json` for Postman/Insomnia import.
