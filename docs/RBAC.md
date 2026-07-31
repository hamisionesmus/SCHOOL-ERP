# Role-Based Access Control

## 1. Model

- `Role` — named, per-tenant (system-seeded roles are marked `isSystemRole=true` and cannot be
  deleted; tenants may add custom roles later).
- `Permission` — `code` of the form `MODULE:ACTION`, e.g. `ATTENDANCE:MARK`, `FINANCE:APPROVE_INVOICE`.
- `RolePermission` — join table; a role's effective permissions are the union of its granted rows.
- `UserRole` — a user can hold multiple roles (e.g. Class Teacher + Club Patron); effective
  permissions are the union across all held roles.
- Enforcement: `@RequirePermission('MODULE:ACTION')` on a controller route + a guard that loads the
  request user's roles → permissions and checks membership. Denied requests return 403 with no
  partial data. This is always server-side; the frontend hides/shows UI based on the same permission
  list fetched at login, but that is a UX convenience, never the security boundary.

## 2. Full role list and scope

The source requirements list ~37 roles. Every role below gets a seed `Role` row and a documented
permission set; **wired guards + working endpoints exist today only for the six marked `[BUILT]`** —
the rest activate as their modules land per the phase roadmap in `docs/ARCHITECTURE.md`, without
needing schema changes (the model already supports arbitrary roles/permissions).

| Role | Status | Primary module access |
|---|---|---|
| Super Admin | `[BUILT]` | Platform: all tenants, billing, plans, impersonation |
| School Director | planned | Cross-module read, finance approval |
| School Administrator | `[BUILT]` | Full tenant admin: users, roles, settings |
| Principal | planned | Academic + discipline approval, exam reopen rights |
| Deputy Principal | planned | Academic + discipline (delegate of Principal) |
| Head Teacher | planned | Attendance reopen rights, academic oversight |
| Academic Director | planned | Curriculum, timetable, exam policy |
| Finance Officer | `[BUILT]` | Fees, invoices, receipts, payments (no exam/HR edit) |
| Bursar | planned | Finance (senior) incl. payroll approval |
| Examination Officer | planned | Exam scheduling, mark approval workflow |
| Class Teacher | `[BUILT]` | Own class: attendance submit, homework, CBC comments |
| Subject Teacher | planned | Own subject: marks entry, assignments |
| Discipline Master | planned | Discipline cases, behavior records |
| Games Teacher | planned | Co-curricular records |
| Club Patron | planned | Club membership, activity records |
| Librarian | planned | Library catalogue, loans, fines |
| ICT Officer | planned | System settings (scoped), device management |
| Receptionist | planned | Visitor log, front-desk info |
| Admissions Officer | planned | Admissions pipeline |
| HR Officer | planned | Staff records, leave, contracts |
| Store Keeper | planned | Inventory, stock movements |
| Procurement Officer | planned | Purchase orders, suppliers |
| Kitchen Manager | planned | Meal planning, kitchen inventory |
| Cook / Kitchen Staff | planned | Daily menu execution (read-mostly) |
| Security Officer | planned | Gate/security dashboard |
| Gate Officer | planned | Biometric gate events, visitor check-in |
| Driver | planned | Own route/trip log |
| Transport Manager | planned | Vehicles, routes, driver assignment |
| Cleaner / Grounds Keeper | planned | Task checklists (read-mostly) |
| School Nurse | planned | Health module |
| Counselor | planned | Discipline + health (sensitive-record access) |
| Lab Technician | planned | Lab inventory |
| Board Member | planned | Read-only cross-module reports |
| Parent | `[BUILT]` | Own children only: attendance, results, fees, messages |
| Student | `[BUILT]` | Own record only: homework, results, timetable |
| Alumni | planned | Limited read (own historical record) |
| Visitor | planned | No portal access — front-desk log only |
| Temporary Staff / Support Staff | planned | Scoped per assignment, time-bound account |

## 3. Permission matrix — representative example (matches source spec examples)

| Module:Action | Class Teacher | Subject Teacher | Finance Officer | School Administrator | Parent | Student |
|---|---|---|---|---|---|---|
| ATTENDANCE:MARK (own class) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| ATTENDANCE:VIEW | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| ATTENDANCE:REOPEN | ❌ (Head Teacher/Principal only) | ❌ | ❌ | ✅ | ❌ | ❌ |
| EXAM:MANAGE (create exam/exam-subjects) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| EXAM:ENTER_MARKS (own subject assignment only) | ✅ (if subject teacher) | ✅ | ❌ | ✅ | ❌ | ❌ |
| EXAM:APPROVE (approve/reject submitted marks) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| EXAM:REOPEN (unlock after approval) | ❌ (Head Teacher/Principal only) | ❌ | ❌ | ✅ | ❌ | ❌ |
| EXAM:EDIT_OTHER_TEACHER_MARKS | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| EXAM:DELETE_RESULT | ❌ | ❌ | ❌ | ❌ (Principal-reopen flow only) | ❌ | ❌ |
| HOMEWORK:ASSIGN | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| HOMEWORK:VIEW | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| ADMISSION:MANAGE | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| ANNOUNCEMENT:SEND_TO_PARENTS | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| FINANCE:RECEIVE_PAYMENT | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| FINANCE:PRINT_RECEIPT | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| FINANCE:APPROVE_INVOICE | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| FINANCE:EDIT (general ledger) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| EXAM:EDIT_MARKS (cross-check) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ATTENDANCE:EDIT (cross-check) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| HR:EDIT | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| PAYROLL:APPROVE | ❌ | ❌ | ❌ (Bursar/Admin only) | ✅ | ❌ | ❌ |
| LIBRARY:MANAGE | ❌ (Librarian role not built) | ❌ | ❌ | ✅ | ❌ | ❌ |
| TRANSPORT:MANAGE | ❌ (Transport Manager role not built) | ❌ | ❌ | ✅ | ❌ | ❌ |
| INVENTORY:MANAGE | ❌ (Store Keeper role not built) | ❌ | ❌ | ✅ | ❌ | ❌ |
| HEALTH:MANAGE | ❌ (School Nurse role not built) | ❌ | ❌ | ✅ | ❌ | ❌ |
| DISCIPLINE:MANAGE | ❌ (Discipline Master role not built) | ❌ | ❌ | ✅ | ❌ | ❌ |
| STUDENT:VIEW_OWN_CHILD | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| STUDENT:VIEW_OWN_RECORD | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| TENANT:MANAGE_USERS | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| SETTINGS:MANAGE (branding, mission/vision/motto) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| TRANSPORT:PROPOSE (propose a trip) | ✅ | ❌ | ❌ | ✅ (also holds TRANSPORT:MANAGE) | ❌ | ❌ |
| BIOMETRIC:MANAGE (log a face/fingerprint scan) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

This table directly encodes the "can / cannot" examples from the source requirements (teachers
cannot edit finance/delete exam results/edit another teacher's marks/approve payroll; finance
officers cannot edit exam marks/attendance/HR).

`STUDENT:VIEW_OWN_CHILD` and `STUDENT:VIEW_OWN_RECORD` also gate row-level scoping in Attendance,
Homework, and report cards (a Parent sees only their children's records, a Student only their own) —
the same scoping pattern used in `StudentsService.list()`, reused by `AttendanceService`,
`HomeworkService`, and `ExamsService.reportCard()` rather than adding separate
`_OWN_CHILD`/`_OWN_RECORD` variants per module. Report cards additionally only surface marks from an
`ExamSubject` in `APPROVED` status — a Parent/Student never sees a mark still in `DRAFT`/`SUBMITTED`.

Finance (Phase 4) needed no new permission codes: `FINANCE:EDIT` gates fee-structure/invoice
management, `FINANCE:RECEIVE_PAYMENT` gates payments and M-Pesa STK actions, and invoice visibility
reuses the same `STUDENT:VIEW_OWN_CHILD`/`VIEW_OWN_RECORD` scoping as everywhere else — the Phase 1
catalog already covered this module's needs. `ANNOUNCEMENT:SEND_TO_PARENTS` (also already existed)
gates sending SMS in the Communications module.

## 4. Phase 6 additions

Two new permission codes were added for the Settings and Trips modules: `SETTINGS:MANAGE` (School
Administrator only — branding/mission/vision/motto) and `TRANSPORT:PROPOSE` (Class Teacher and School
Administrator — propose a trip; approving/rejecting still requires the existing `TRANSPORT:MANAGE`).
Everything else in Phase 6 (student photo upload, logo upload, PDF report card download, trip
registration/payment) reused existing codes — `STUDENT:EDIT` for photo upload,
`STUDENT:VIEW_OWN_CHILD`/`VIEW_OWN_RECORD` for trip registration/payment and PDF report-card download,
exactly the same scoping pattern already used everywhere else in this table.

## 5. Phase 7 additions

No new permission codes. The `GET /dashboard` endpoint reuses `TENANT:MANAGE_USERS`, `FINANCE:EDIT`/
`FINANCE:RECEIVE_PAYMENT`, `ATTENDANCE:MARK`, `TRANSPORT:MANAGE`/`TRANSPORT:PROPOSE`, and
`STUDENT:VIEW_OWN_CHILD`/`VIEW_OWN_RECORD` to decide which sections of the response to compute for the
caller — the same "server decides what's included" pattern as `StudentsService.list()`, just applied
to five independent sections instead of one dataset. `PATCH /classes/:id` (class teacher assignment)
reuses `TENANT:MANAGE_USERS`, matching the existing `POST /classes` gate.

## 6. Phase 8 additions

One new permission code: `BIOMETRIC:MANAGE` (School Administrator and Class Teacher — log a
face/fingerprint scan event; see docs/SRS.md §4.9 for why this is an honest event-log stub, not real
hardware). Viewing biometric events reuses the existing scoping pattern with no new codes: a holder of
`BIOMETRIC:MANAGE` sees every event, a guardian (`STUDENT:VIEW_OWN_CHILD`) sees their own children's
STUDENT events, a student (`STUDENT:VIEW_OWN_RECORD`) sees their own, and any authenticated staff
member sees their own STAFF (clock-in/out) events regardless of role. Everything else in Phase 8 —
student address/geo edit, Payslips, Work Log, the Kitchen page, the Super Admin usage endpoint —
reused existing codes: `STUDENT:EDIT` for the student edit form (already covered every other student
field), `HR:EDIT` for issuing payslips (a staff member always sees their own regardless of
permission), `INVENTORY:MANAGE` for the Kitchen page (same engine as Inventory, see docs/SRS.md
§4.22), and the Super Admin's existing `@RequirePlatformRole()` gate for the usage endpoint. Work Log
needs no permission code at all beyond authentication — any signed-in staff member logs their own day,
the same pattern as `LeaveRequest` creation.

## 7. Phase 9 additions

No new tenant-side permission codes. The Parent/Student attendance-view fix (docs/SRS.md §4.13) and the
notification bell (§4.4) both reuse existing codes — the bell computes each item under the same
permission that already gates its underlying module (`HR:EDIT`, `ADMISSION:MANAGE`, `TRANSPORT:MANAGE`,
`INVENTORY:MANAGE`, `EXAM:APPROVE`, `FINANCE:EDIT`/`APPROVE_INVOICE`, `STUDENT:VIEW_OWN_CHILD`/
`VIEW_OWN_RECORD`) rather than introducing a new `NOTIFICATION:*` code. All of the new Super Admin
billing/backups/audit-log/password-reset functionality is gated by the existing platform-level
`@RequirePlatformRole()` guard (Super Admin only) — there is no tenant-schema RBAC involved since none
of it runs inside a tenant's schema-scoped request.

## 8. Seed data (Phase 1)

`apps/api/prisma/seed.ts` creates, per new tenant: the six `[BUILT]` roles above, their permission
rows per the matrix, and the tenant's first `School Administrator` user (credentials emailed/shown to
the Super Admin at tenant-creation time in a later phase; Phase 1 prints them to the API response for
manual handoff during development).
