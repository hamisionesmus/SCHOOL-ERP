# Software Requirements Specification (SRS)
## Kenyan CBC School Management ERP — Multi-Tenant SaaS

Version 0.1 (Phase 0/1 scope). This SRS covers the full target product; sections are tagged
`[BUILT]`, `[SCAFFOLDED]`, or `[PLANNED]` to distinguish what exists in the current codebase from
what the architecture supports and future phases will implement. See `docs/ARCHITECTURE.md` for the
phase roadmap.

## 1. Purpose & Scope

A cloud-based, multi-tenant Software-as-a-Service ERP for Kenyan schools running the Competency Based
Curriculum (CBC), covering learners from PP1 through Grade 9. One deployment serves many schools
("tenants"), each with fully isolated data, under a central Super Admin platform layer.

## 2. Grade Levels Supported

PP1, PP2, Grade 1–9 (junior secondary boundary), modeled as a per-tenant configurable list of
`GradeLevel` records (not hardcoded), so a tenant can enable only the levels it teaches and future
curriculum changes (e.g. Grade 10+ senior school) don't require a schema migration.

## 3. Actors / Roles

Full role list and permissions: see `docs/RBAC.md`. Summary categories:
- Platform: Super Admin `[BUILT]`
- Leadership: School Director, School Administrator `[BUILT]`, Principal, Deputy Principal, Head Teacher, Academic Director, Board Member `[PLANNED]`
- Academic staff: Class Teacher `[BUILT — role model]`, Subject Teacher, Examination Officer, Discipline Master, Games Teacher, Club Patron, Librarian `[PLANNED]`
- Finance/ops: Finance Officer `[BUILT — role model]`, Bursar, Store Keeper, Procurement Officer `[PLANNED]`
- Support staff: ICT Officer, Receptionist, Admissions Officer, HR Officer, Kitchen staff, Security/Gate Officer, Driver, Transport Manager, Cleaner, Grounds Keeper, School Nurse, Counselor, Lab Technician `[PLANNED]`
- External: Parent `[BUILT — role model]`, Student `[BUILT — role model]`, Alumni, Visitor, Temporary Staff `[PLANNED]`

`[BUILT — role model]` means the role, its permission rows, and enforcement guard exist; module UIs
for that role's day-to-day workflows land in later phases per `docs/ARCHITECTURE.md`.

## 4. Functional Requirements by Module

Each module below states target scope. Build status is tracked in the phase roadmap, not repeated
per line here to keep this scannable.

### 4.1 Platform / Super Admin
Create/suspend/activate schools, assign subscription plans & storage limits, usage monitoring,
billing, system analytics, impersonate school admin, push updates, platform-wide announcements.
`[BUILT: create/list/suspend/activate tenant, per-tenant payment/banking config
(PATCH /platform/tenants/:id/payment-config — API only, no Super Admin UI page yet), real per-school
storage usage (GET /platform/tenants/:id/usage — sums pg_total_relation_size across every table in
the tenant's Postgres schema plus the tenant's uploads-folder byte size, not an estimate; shown as a
column on the Super Admin dashboard, flagged red past 90% of storageLimitMbOverride when set), a
sidebar-shelled Super Admin app (Schools list, Backups) instead of one flat page, a per-school detail
page (Overview/Billing/Audit Log tabs) with real subscription billing — PlatformInvoice/
PlatformPayment models, issuing an invoice emails the school admin (platform EmailProvider stub, logs
instead of sending — mirrors SmsProvider exactly), recording a payment that reaches the invoice
amount marks it PAID, extends Tenant.currentPeriodEnd, and automatically reactivates a SUSPENDED
tenant regardless of method (bank/M-Pesa/cash) — the manual step is confirming the payment happened,
not the reactivation logic; a downloadable invoice/receipt PDF; a renewal countdown computed from
currentPeriodEnd (30-day grace period set at tenant creation); a School Administrator password-reset
action that generates a fresh temporary password shown exactly once — real passwords are never
displayed anywhere, to the Super Admin or anyone else, since they're one-way bcrypt hashes; a
cross-schema audit-log view (GET /platform/tenants/:id/audit-logs, reads the tenant's own AuditLog
table by schema name); a backups list + trigger (GET/POST /platform/backups, background-runs
prisma/backup-database.ts, which shells out to `docker compose exec` for pg_dump since Postgres runs
in Docker, not on the host, in this environment); **payment-gated account activation**: a non-demo
school is created locked (`PENDING_PAYMENT`, login blocked — see §4.3-adjacent auth gate in
AuthService.login) with a first `PlatformInvoice` for a Super-Admin-set one-time activation fee; the
welcome email carries a public, token-signed `/activate/:token` link (no login required — the school
can't log in yet) where the school triggers a real Safaricom Daraja STK Push, and Safaricom's async
callback (`POST /public/activation/mpesa-callback`) records the `PlatformPayment` (method MPESA,
unattributed to any Super Admin — see `PlatformPayment.recordedByUserId` nullability), marks the
invoice PAID, flips the tenant to `ACTIVE`, and sends a second email + SMS confirming the account is
live; the Super Admin can also manually activate a `PENDING_PAYMENT` school (e.g. paid by bank/cash)
from the same Activate control used for `SUSPENDED`, and can copy/resend the activation link from the
school detail page. Demo accounts are unaffected — still free, expiry-gated, no payment step. Real
outbound email (Resend) and SMS (Advanta SMS) replace the logging-only stubs when their API keys are
configured, with automatic fallback to the stub when not (see `platform-email.module.ts`/
`communications/sms-provider.module.ts`); PLANNED: subscription plan assignment UI, usage analytics
beyond storage, impersonation, push updates, payment-config UI, an M-Pesa/bank webhook for the
*recurring renewal* invoice flow specifically (that one is still a manual Super-Admin action — see
Finance §4.18 for the identical caveat on the tenant-side M-Pesa stub; only the one-time activation
payment is now a real automated STK Push)]`

### 4.2 Multi-Tenancy
Each school: own isolated data (schema-per-tenant), logo/colors/branding, name/address/website, SMS
sender ID, payment config, grading system, academic calendar, transport routes, users, teachers,
students, finance, examinations. No cross-tenant data access under any circumstance.
`[BUILT: schema isolation, branding fields with a self-service School Administrator Settings page
(logo upload, name, colors, address, website, SMS sender ID, mission/vision/motto — all of which
flow through to the branded PDF report card, see §4.14), core entities, per-tenant payment config
(Super-Admin-only, see §4.1); PLANNED: SMS provider config UI]`

### 4.3 RBAC
Configurable permissions per role, module × action granularity (e.g. Teacher can mark attendance,
enter marks for own subject, upload assignments, message parents; cannot edit finance, delete exam
results, edit another teacher's marks, or approve payroll). See `docs/RBAC.md` for the full matrix.
`[BUILT: permission model + guard + seed for 6 representative roles; PLANNED: remaining roles]`

### 4.4 Dashboards
Role-specific dashboards (Super Admin, Teacher, Student, Parent, Finance, etc.) surfacing the
information relevant to that role — timetable, pending tasks, results, fee balance, alerts.
`[BUILT: permission-gated sidebar app shell for all tenant-side roles (School Administrator/Class
Teacher/Finance Officer/Parent/Student), replacing the earlier flat top-nav; a role-scoped analytics
dashboard at /school (`GET /dashboard`, see §4.32) with animated stat cards and recharts
bar/pie/line charts, sections computed conditionally by permission so each role sees only what's
relevant to it (School Administrator: student/staff/finance/trip stats; Class Teacher: own-class
attendance trend; Parent/Student: own children's attendance/fees/next trip); a restyled Super Admin
dashboard with the same stat-card/chart treatment, now behind its own sidebar shell (see §4.1); a
computed notification bell (GET /notifications) surfacing pending leave requests, pending admissions,
trips awaiting approval, low-stock items, mark-sheets awaiting approval, overdue invoices, and (for
Parent/Student) their own fee balance/upcoming trip — one item per condition, each gated by the same
permission that gates the underlying module, not a persisted notification table; a sidebar
collapse-to-icon-rail toggle (persisted per browser) and an independently-scrolling sidebar/main
content pane (previously the whole page scrolled together); client-side sort/paginate
(`useTableControls` + `<Pagination>`/`<SortableTh>`) applied to the Super Admin schools list and
several tenant list pages — not yet every list page in the app; PLANNED: pending-task/alert widgets
beyond the notification bell, pagination/sorting on the remaining list pages]`

### 4.5 Admissions
Online application, document upload, interview scheduling, approval workflow, waiting list, student
number generation, admission letters, transfer-in records, sibling linking.
`[BUILT: application CRUD, status workflow (Applied→Interview→Offered/Rejected/Waitlisted→Admitted),
admit-to-Student conversion with guardian account creation; PLANNED: document upload, interview
scheduling, admission letters]`

### 4.6 Student Information System (SIS)
Full learner profile: photo, biometric refs, birth certificate, NEMIS/UPI numbers, demographics
(religion, nationality, county/sub-county/ward), medical info, guardians/emergency contacts, academic
& behavior history, transport/library/fee/exam history, CBC assessments, document store.
`[BUILT: core Student entity, guardian linking (STUDENT:EDIT-gated), photo upload (via UploadsModule,
shown as a profile thumbnail on the Students list and printed on the branded PDF report card), a full
edit form (name/DOB/gender/grade — previously only photoUrl/upiNumber/nemisNumber/currentClassId were
patchable via PATCH /students/:id, everything else was create-only), home
address/landmark/latitude/longitude captured at creation or edit via a Leaflet/OpenStreetMap pin-drop
map (no paid geocoding/maps API key anywhere in this repo — see §4.11 for how it feeds transport);
PLANNED: remaining profile fields (medical as first-class UI — MedicalAlert already exists per-module,
see §4.23), documents]`

### 4.7 Teacher Management
Profile, TSC number, employment history, qualifications, contracts, leave, payroll link, subject/class
assignment, lesson plans, schemes of work, attendance, CPD/training, documents. `[PLANNED — Phase 2/5]`

### 4.8 Non-Teaching Staff
Kitchen, drivers, security, cleaners, reception, ICT, stores, grounds, library, support staff —
attendance, salary, department, leave, performance, documents, statutory numbers (NSSF/NHIF/SHA),
bank details, biometric.
`[BUILT: every staff member (teaching or not — RBAC already treats "any non-Parent/Student role" as
staff uniformly, so no separate non-teaching-staff role/module was needed) gets a Payslips tab
(HR-issued, downloadable PDF — see §4.19) and a daily Work Log (self-reported tasks-done/pending,
one entry per staff per day) on the existing HR & Staff Portal page; biometric time-in/out is the
event-log stub in §4.9; PLANNED: department/performance tracking, statutory numbers (NSSF/NHIF/SHA)
as first-class fields, automatic payroll computation]`

### 4.9 Biometric Attendance & Security
Facial recognition attendance for students (gate scan → auto attendance + SMS to parent on arrival
and departure), staff biometric time-in/out (feeds payroll), visitor registration & badge printing,
security dashboard (live gate feed, who's on site, missing-student/emergency evacuation list).
Architecture: device/edge integration posts events to a webhook; the platform does not perform
on-device face matching itself.
`[BUILT: an honest event-log stub — `BiometricEvent` (subjectType STUDENT|STAFF, method
FACE for learners / FINGERPRINT for staff, enforced server-side, direction IN|OUT), logged via
POST /biometric-events (BIOMETRIC:MANAGE-gated) through a simple form standing in for what a real
device webhook would post automatically in production — no on-device face/fingerprint matching or
physical hardware exists in this codebase; a STUDENT OUT event automatically fires the guardian
departure SMS (see §4.10/§4.11); events are retained forever (`archived` boolean for a soft-archive
toggle, but no DELETE route exists anywhere in the module); visibility is scoped like everywhere
else — BIOMETRIC:MANAGE sees all, a guardian sees their own children's STUDENT events, a staff member
sees their own STAFF events; PLANNED: real device/ML integration, visitor registration, live security
dashboard]`

### 4.10 SMS / Communications
Automatic SMS for arrival/departure, fee reminders, results, absentee/discipline alerts, transport
delays, homework/meetings/events/birthdays/emergencies. Provider-agnostic abstraction supporting
Africa's Talking, Twilio, Safaricom, Celcom. Also email, push, WhatsApp, internal messaging, notice
board.
`[BUILT: SmsProvider interface + StubSmsProvider (logs instead of calling a real gateway — no API
credentials configured for this environment), SmsMessage delivery log, manual announcement send
(ANNOUNCEMENT:SEND_TO_PARENTS, recipients picked by class → guardians), automatic payment-receipt SMS
triggered from FinanceService, automatic trip-approval broadcast SMS (to every guardian, on approval)
and trip-payment-confirmation SMS from the Phase 6 Trips module (see §4.31), automatic
departure-notification SMS (see §4.9/§4.11) fired on a STUDENT OUT biometric event; PLANNED: real
Africa's Talking/Twilio/Safaricom implementation (swap-in, no call-site changes needed), email/push/
WhatsApp channels, message templates, automatic arrival/absentee triggers]`

### 4.11 Transport
Vehicles, drivers, routes, pickup points, bus attendants, trip logs, fuel/maintenance/insurance;
parent visibility of pickup/drop time and (where hardware available) live bus location; boarding/
drop notifications; driver attendance.
`[BUILT: Vehicle (with driver, a User with any role), Route (with assigned vehicle, and an
admin-set `estimatedMinutes` static travel-time estimate — no live GPS in this environment),
one-route-per-student TransportAssignment, Parent/Student-scoped visibility of their own child's
route/vehicle/driver, one-off school Trips (see §4.31 — a distinct workflow from daily route
transport: teacher proposes, admin approves/rejects, parent registers a child and pays a per-trip
fee), automatic departure-notification SMS — a STUDENT OUT biometric event (§4.9) fires
"[Name] has left school at [time]. Expected home in about N minutes" to every guardian, using the
student's route.estimatedMinutes (falls back to "arrange pickup" copy if no route/estimate is set);
PLANNED: pickup points, daily trip logs (route/vehicle side, not the Trips module),
fuel/maintenance/insurance records, live GPS location (would replace the static ETA), driver
attendance]`

### 4.12 Academic / Timetable
Academic year/terms/calendar, timetable, lesson planning, schemes of work, learning outcomes,
subjects/classes/streams/teacher assignment, CBC competencies.
`[BUILT: AcademicYear, SchoolClass, a dedicated Classes management page (School-Administrator-only)
to create classes and assign/reassign each class's class teacher of record via
PATCH /classes/:id — this is what actually activates a Class Teacher's attendance-marking rights,
since AttendanceService has enforced classTeacherId since Phase 2 but there was previously no UI to
set it; PLANNED: timetable, lesson planning, streams as a distinct concept from SchoolClass]`

### 4.13 Attendance
Per-lesson/per-day register; only the assigned class teacher submits a class's attendance; once
submitted the record locks (only Head Teacher/Principal can reopen, with a reason, under audit).
`[BUILT: mark/lock/reopen with class-teacher-of-record + ATTENDANCE:REOPEN enforcement, audit log
entries, Parent/Student-scoped read-only views (fixed a Phase 9 frontend bug where Parent/Student
viewers were rendered an editable status dropdown per student — the backend never accepted their
writes, but the UI implied they could mark attendance; now gated on the same permission check used to
decide whether the row is editable at all, rendering a read-only status Badge otherwise); PLANNED:
per-lesson (vs per-day) granularity, reopen reason field]`

### 4.14 Examinations & CBC Assessment
CATs, midterm, end-term, CBC competency assessments, projects, rubrics, practicals. A teacher enters
marks only for their assigned subject and cannot edit another teacher's marks. Submitted marks lock;
Academic Office can approve/reject/return-for-correction; once approved, only a Principal with
reopen-rights can unlock, under audit. Outputs: report cards, rankings, performance/grade-distribution/
subject/teacher/class/trend analysis, CBC competency reports, parent-facing report portal.
`[BUILT: Subject/SubjectAssignment model (teacher × subject × class), Exam/ExamSubject/Mark with full
DRAFT→SUBMITTED→APPROVED workflow, subject-assignment-of-record enforcement on marks entry (mirrors
the class-teacher-of-record check on attendance), EXAM:APPROVE-gated approve/reject, EXAM:REOPEN-gated
reopen, per-student report card scoped to APPROVED marks only, audit log entries, downloadable
branded PDF report card (`GET /exams/:examId/report-card/:studentId/pdf`, rendered server-side with
`pdfkit`, pulling the tenant's logo/mission/vision/motto from Settings and the student's photo/
admission number/grade — see §4.29) with a real per-student filename
(`Lastname_Firstname_ExamName_TermN_ReportCard.pdf`, sanitized — previously always the generic
`report-card.pdf`) and admin-configurable pass-mark coloring (`Tenant.passMarkPercent`, set on the
Settings page): each numeric score renders green at/above the pass mark and red below it, CBC rubric
levels use a fixed EE/ME=green, AE=amber, BE=red mapping, applied identically in the PDF and the
on-screen report-card table so they never disagree; PLANNED: rankings, grade-distribution/trend
analysis, teacher/class-level analytics]`

### 4.15 CBC Module
Learning areas, competencies, values, rubrics, performance levels, projects, teacher/parent comments,
competency reports, portfolio/evidence uploads.
`[BUILT: 4-level CBC rubric (EE/ME/AE/BE) as a per-exam-subject scoring mode alongside numeric scoring,
selected when the exam-subject is created; PLANNED: learning-area/competency taxonomy as first-class
entities (currently a rubric level is just an alternative Mark value, not tied to a competency
framework), portfolio/evidence uploads, dedicated CBC competency report]`

### 4.16 Homework
Assignments, file uploads, deadlines, submissions, grading, teacher comments, late-submission
handling. `[BUILT: assignment creation, per-class listing, student submission marking, Parent/Student
scoped views; PLANNED: file uploads, grading UI, late-submission flagging]`

### 4.17 Discipline
Cases, warnings, suspensions, detentions, positive-behavior rewards, parent notification, behavior
trend reporting.
`[BUILT: DisciplineCase (WARNING/DETENTION/SUSPENSION/POSITIVE_BEHAVIOR), automatic SMS to the
student's primary guardian on every case (same pattern as Finance's payment-receipt SMS),
Parent/Student-scoped visibility; PLANNED: behavior trend reporting/analytics, a dedicated Discipline
Master role (currently DISCIPLINE:MANAGE is School-Administrator-only, like the other Phase 5 modules
— see docs/RBAC.md)]`

### 4.18 Finance
Fee structures, invoices, receipts, discounts/scholarships/waivers, installments, penalties, arrears,
refunds, expenses/income, petty cash, bank reconciliation, budgeting, payroll, General
Ledger/Trial Balance/Balance Sheet/Income Statement/Cash Flow, assets/liabilities, procurement
(purchase orders, suppliers), M-Pesa STK Push, bank integration, QR/online payments, reminders.
`[BUILT: FeeStructure (per grade level/year/term) → bulk Invoice generation (idempotent, skips
students who already have one), Payment recording (CASH/BANK/MPESA) with sequential receipt
numbering, denormalized invoice balance/status kept in sync on every payment, overpayment rejected,
Parent/Student-scoped invoice visibility, automatic SMS receipt to the primary guardian, M-Pesa STK
Push initiate + confirm as a documented stub (no real Daraja credentials — see MpesaStkRequest model
comment in schema.prisma for the production callback-routing gap); PLANNED: discounts/scholarships/
waivers, installment plans, penalties/arrears aging, refunds, expenses/petty cash/bank reconciliation/
budgeting, payroll, General Ledger and financial statements, procurement, real M-Pesa Daraja
integration, QR/online payments]`

### 4.19 HR
Recruitment, interviews, contracts, leave, payroll, appraisal, training, promotion, disciplinary
actions, exit management, staff attendance (biometric-fed).
`[BUILT: LeaveRequest self-service workflow (any staff member requests, HR:EDIT approves/rejects,
PENDING→APPROVED/REJECTED, requester sees only their own, HR:EDIT sees all — reuses the existing
HR:EDIT permission from Phase 1, no new code needed); a Payslips tab (`Payslip` model — HR:EDIT issues
one per staff member per calendar month with gross/deductions, netPay computed server-side rather
than trusted from the client; the staff member downloads their own as a PDF via
`GET /hr/payslips/:id/pdf`, HR:EDIT can download anyone's; explicitly not an automatic payroll engine
— amounts are entered manually by HR, nothing is computed from hours/attendance); a daily Work Log
(`WorkLog`, one row per staff member per date — upsert on resubmission rather than duplicate rows —
self-reported tasksDone/tasksPending, HR:EDIT sees everyone's, a staff member sees only their own);
staff biometric time-in/out is the event-log stub in §4.9; PLANNED: recruitment, contracts, appraisal,
training, promotion, disciplinary actions (staff-facing, distinct from the student Discipline
module), exit management, and automatic payroll computation from hours/attendance (GL and financial
statements are also called out as PLANNED under Finance §4.18)]`

### 4.20 Library
Catalogue, borrowing/returns/reservations, barcodes, fines, digital library, per-student borrowing
history.
`[BUILT: Book catalogue with copy counts, Loan issue/return with available-copy tracking, flat
per-day-late fine computed on return, Parent/Student-scoped loan history; PLANNED: reservations,
barcodes/scanning, digital library, a dedicated Librarian role]`

### 4.21 Inventory
Store, assets, consumables, kitchen/lab/ICT/uniform/stationery inventories, stock movements, purchase
requests & approvals.
`[BUILT: InventoryItem with reorder-level flagging, IN/OUT StockMovement with running quantity,
staff-only (no student/parent visibility — inventory isn't their concern), `GET /inventory/items`
accepts an optional `?category=` filter (used by the Kitchen page, see §4.22 — deliberately not a
separate stock system); PLANNED: purchase requests/approvals workflow, dedicated views for the other
categories (lab/ICT/uniform), a dedicated Store Keeper role]`

### 4.22 Kitchen
Meal planning, daily menu, student meal attendance, food stock, suppliers, gas usage, cooking
schedule, nutrition reports.
`[BUILT: daily stock intake/usage recording and remaining-quantity tracking — reuses the Inventory
module's InventoryItem/StockMovement engine (§4.21) filtered to category="Kitchen" rather than a
parallel stock system, so "record 50kg of maize flour delivered" / "record 8kg used for lunch" and
the running-quantity math (and low-stock flagging against reorderLevel) are the exact same code path
already proven in Phase 5; a dedicated /school/kitchen page with unit-aware intake/usage recording
(kg/litres/bags/pcs/crates) and a reason/source note per movement; PLANNED: meal planning, daily
menu, student meal attendance, supplier records, gas usage, nutrition reports]`

### 4.23 Health
Clinic visits, medication, allergies, vaccinations, medical reports, emergency treatment, medical
alerts with parent notification.
`[BUILT: MedicalAlert (condition/severity/notes, e.g. allergies), ClinicVisit log (symptoms/treatment/
medication), Parent/Student-scoped visibility; PLANNED: vaccinations, formal medical reports, parent
SMS notification on new alert/visit (same CommunicationsService pattern used by Finance/Discipline,
not yet wired for this module), a dedicated School Nurse role. Note: the `/health` API path name is
purely a domain-naming choice here — it is not a Kubernetes/load-balancer liveness endpoint; a real
production deployment should add a separate `/healthz`-style check outside this module if needed.]`

### 4.24 Portals
Parent portal (all children, attendance, results, transport, fees, messages, medical, behavior,
timetable, library, downloads), Student portal (homework, attendance, results, CBC reports, library,
messages, timetable, downloads). `[SCAFFOLDED: auth + role model; PLANNED — Phase 2+: content per module]`

### 4.25 Mobile Applications
Teacher, Parent, Student, Driver, Security apps (Expo/React Native) consuming the same REST API;
offline mode, push notifications, biometric device support, QR scanning. `[PLANNED — Phase 8]`

### 4.26 Reporting
Cross-module report generation (attendance, finance, payroll, inventory, library, transport,
academic, CBC, HR, discipline, medical, admissions, government/statutory reports), export to
PDF/Excel/CSV. `[BUILT: first PDF export — the branded student report card, see §4.14/§4.29;
PLANNED: everything else, incrementally per module, consolidated reporting engine in Phase 9]`

### 4.27 Audit Trail
Every mutating action logged: actor, action, timestamp, old/new value, IP, device. No hard deletes —
soft delete only. `[BUILT: soft-delete convention + AuditLog model + interceptor for core entities; PLANNED: full module coverage as modules land]`

### 4.28 AI Features
AI report-card narrative writing, performance analysis, teacher recommendations, timetable
optimization, fee-default prediction, attendance-anomaly prediction, behavioral alerts, chatbot,
academic assistant, document search. Designed as an opt-in service layer calling an LLM provider, not
a hard dependency of core workflows. `[PLANNED — Phase 8]`

### 4.29 School Settings / Branding
Self-service branding configuration per tenant: school name, logo, primary color, address, website,
SMS sender ID, mission, vision, motto. Populates report cards, portal headers, and (eventually) other
printable documents. Payment/banking config (M-Pesa paybill, bank name/account) is kept separate and
Super-Admin-only, since it controls where real money is expected to land.
`[BUILT: GET/PATCH /settings (SETTINGS:MANAGE-gated, School Administrator role), logo upload via
UploadsModule, values consumed by the branded PDF report card and the tenant-wide app header;
Super-Admin payment-config endpoint (§4.1) kept intentionally separate and read-only to the tenant;
PLANNED: Super Admin UI for payment config (API exists, no page yet), SMS provider credential config]`

### 4.30 File Uploads
Student photos, school logo, and (eventually) other document attachments across modules.
`[BUILT: UploadsModule — local-disk storage under apps/api/uploads/<tenant-schema>/, served via
Express static assets at /uploads/..., extension allowlist (jpg/jpeg/png/webp) + 5MB size limit,
tenant-scoped storage folder derived from the authenticated user's JWT; explicitly a swap-later stub
mirroring the SmsProvider abstraction pattern — the storage backend can move to S3/GCS without
changing any call site; PLANNED: document attachments for Admissions/Homework/HR, S3/cloud storage,
antivirus scanning]`

### 4.31 Trips
One-off school trips distinct from daily route transport (§4.11): a teacher proposes a trip with a
destination, date, and per-student cost; a School Administrator approves or rejects it; on approval,
every guardian with a child at the school gets a broadcast SMS; parents then register their own
children and pay the exact per-student cost through a trip-specific ledger, receiving a receipt and a
confirmation SMS.
`[BUILT: Trip (PROPOSED→APPROVED/REJECTED/COMPLETED) with TRANSPORT:PROPOSE-gated creation and
TRANSPORT:MANAGE-gated approve/reject, guardian-scoped registration re-using the
STUDENT:VIEW_OWN_CHILD/VIEW_OWN_RECORD pattern, TripRegistration (UNPAID/PAID) with a unique
[tripId, studentId] constraint, TripPayment with its own sequential TRP-YYYY-NNNN receipt series
(kept separate from Finance's RCT- series since trip money is scoped to the trip, not general fees),
payment amount validated to exactly match the trip's costPerStudent, approval-broadcast and
payment-confirmation SMS, a live days-until-trip countdown badge (color-coded: green when >7 days
out, amber within a week, gray once past) computed client-side from tripDate and shown to teachers,
admins, and parents alike on both the Trips list and the dashboard's "Next Trip" card; PLANNED:
partial/installment trip payments, trip capacity limits, a dedicated Transport Manager role (currently
TRANSPORT:MANAGE is School-Administrator-only, like the other Phase 5 modules)]`

### 4.32 Analytics Dashboard
A role-aware landing page replacing the old flat "first tab" pattern — animated stat cards and
recharts bar/pie/line charts summarizing the data most relevant to whoever is logged in.
`[BUILT: GET /dashboard (DashboardModule) computes independent sections conditionally by permission
and runs them in parallel via Promise.all — school (TENANT:MANAGE_USERS: total students, boys/girls
split, students-by-grade bar chart, staff-by-role pie chart, pending admissions count), finance
(FINANCE:EDIT/RECEIVE_PAYMENT: total revenue, outstanding balance, collection rate, invoice-status
breakdown), myClass (ATTENDANCE:MARK, scoped to the caller's own classTeacherId: student count,
today's attendance rate, a 7-day attendance-rate line chart), trips (TRANSPORT:MANAGE/PROPOSE:
upcoming/pending counts, total trip revenue, next trip), own (STUDENT:VIEW_OWN_CHILD/VIEW_OWN_RECORD:
per-child 30-day attendance rate, fee balance, next trip) — a School Administrator holds nearly every
permission and so sees every section, while a Class Teacher/Finance Officer/Parent/Student each see
only their own; PLANNED: date-range filtering, exportable PDF/Excel dashboard snapshots (ties into the
consolidated reporting engine planned for Phase 9, see §4.26)]`

## 5. Non-Functional Requirements

- **Security**: JWT auth (access + refresh), 2FA (TOTP) `[BUILT scaffold]`; face-login, encrypted
  passwords (bcrypt/argon2) `[BUILT]`; per-role permission checks server-side on every request
  `[BUILT]`; API rate limiting, device/session management `[PLANNED]`.
- **Compliance**: Kenya Data Protection Act 2019 and GDPR-aligned data handling — consent tracking,
  data export/erasure requests (soft-delete + anonymization), data residency awareness. `[PLANNED — Phase 10]`
- **Scalability**: target 100,000+ students / 10,000+ teachers across tenants; horizontal scaling of
  API via stateless JWT + Redis-backed sessions/cache/queues; connection pooling (PgBouncer) as tenant
  count grows. `[ARCHITECTURE SUPPORTS; load-tested — Phase 10]`
- **Availability**: containerized services behind a load balancer, health checks, graceful restarts;
  Kubernetes manifests for production. `[PLANNED — Phase 10]`
- **Backups**: `apps/api/prisma/backup-database.ts` shells into the Postgres Docker container
  (`docker compose exec ... pg_dump`, since this environment runs Postgres in Docker rather than as a
  host binary) to dump the entire database in one file (schema-per-tenant means every school's data
  lives in one database, so this covers all of them) plus a `tar --force-local` archive of the
  local-disk uploads folder into timestamped files under `apps/api/backups/`. Runnable via
  `npm run backup`, on a schedule (cron / Windows Task Scheduler — the script itself has no scheduling
  logic), or on demand from the Super Admin Backups page (`GET/POST /platform/backups`).
  `[BUILT: backup script + Super Admin trigger/list UI; PLANNED: automated off-box/cloud upload — this
  environment has no cloud storage credentials to wire it to — retention policy, restore runbook]`
- **Auditability**: see 4.27.
- **Accessibility**: WCAG-conscious component choices (shadcn/ui + Radix primitives), keyboard
  navigation, dark/light mode. `[PLANNED — progressive, from Phase 2 UI work onward]`
- **Localization-ready**: Kenyan context (counties, KES currency, M-Pesa, Africa's Talking) baked into
  domain models rather than hardcoded strings, so English/Kiswahili UI copy can be added later.

## 6. Out of Scope (this SRS revision)

Boarding/hostel is explicitly listed as "future" in the source requirements — modeled as a stub
relation on Student, not built. On-device biometric SDKs and physical hardware integration are
out of scope for this codebase; only the webhook/event-ingestion side is built.
