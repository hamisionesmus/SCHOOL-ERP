# School ERP — Kenyan CBC Multi-Tenant School Management Platform

Cloud-based, multi-tenant SaaS ERP for Kenyan CBC schools (PP1–Grade 9). See `docs/` for the full
design:

- [`docs/SRS.md`](docs/SRS.md) — requirements, full module list, build status per module
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — multi-tenant strategy, stack, phase roadmap
- [`docs/ERD.md`](docs/ERD.md) — data model
- [`docs/RBAC.md`](docs/RBAC.md) — full role list + permission matrix
- [`docs/API.md`](docs/API.md) — endpoint index (live spec at `/api/docs` once running)

This repo is built incrementally, phase by phase (tracked in `ARCHITECTURE.md` §6). Phase 1 (current)
delivers a working vertical slice: multi-tenant provisioning, auth, RBAC, and core student/academic
entities — not the full feature set described in the SRS.

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
- Login with the Super Admin credentials from `.env` (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`),
  then create your first school from the Super Admin dashboard.

## Requirements

Node 20+, Docker (for Postgres/Redis), npm 10+ (workspaces; no separate package manager needed).
