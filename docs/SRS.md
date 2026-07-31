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
`[BUILT: create/list/suspend/activate tenant; PLANNED: billing, analytics, impersonation, updates]`

### 4.2 Multi-Tenancy
Each school: own isolated data (schema-per-tenant), logo/colors/branding, name/address/website, SMS
sender ID, payment config, grading system, academic calendar, transport routes, users, teachers,
students, finance, examinations. No cross-tenant data access under any circumstance.
`[BUILT: schema isolation, branding fields, core entities; PLANNED: payment/SMS provider config UI]`

### 4.3 RBAC
Configurable permissions per role, module × action granularity (e.g. Teacher can mark attendance,
enter marks for own subject, upload assignments, message parents; cannot edit finance, delete exam
results, edit another teacher's marks, or approve payroll). See `docs/RBAC.md` for the full matrix.
`[BUILT: permission model + guard + seed for 6 representative roles; PLANNED: remaining roles]`

### 4.4 Dashboards
Role-specific dashboards (Super Admin, Teacher, Student, Parent, Finance, etc.) surfacing the
information relevant to that role — timetable, pending tasks, results, fee balance, alerts.
`[SCAFFOLDED: Super Admin dashboard shell; PLANNED: remaining role dashboards]`

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
`[BUILT: core Student entity, guardian linking (STUDENT:EDIT-gated); PLANNED: full profile fields (biometric, medical, NEMIS/UPI as first-class UI), documents]`

### 4.7 Teacher Management
Profile, TSC number, employment history, qualifications, contracts, leave, payroll link, subject/class
assignment, lesson plans, schemes of work, attendance, CPD/training, documents. `[PLANNED — Phase 2/5]`

### 4.8 Non-Teaching Staff
Kitchen, drivers, security, cleaners, reception, ICT, stores, grounds, library, support staff —
attendance, salary, department, leave, performance, documents, statutory numbers (NSSF/NHIF/SHA),
bank details, biometric. `[PLANNED — Phase 5]`

### 4.9 Biometric Attendance & Security
Facial recognition attendance for students (gate scan → auto attendance + SMS to parent on arrival
and departure), staff biometric time-in/out (feeds payroll), visitor registration & badge printing,
security dashboard (live gate feed, who's on site, missing-student/emergency evacuation list).
Architecture: device/edge integration posts events to a webhook (`POST /attendance/biometric-events`);
the platform does not perform on-device face matching itself. `[PLANNED — Phase 6, integration layer]`

### 4.10 SMS / Communications
Automatic SMS for arrival/departure, fee reminders, results, absentee/discipline alerts, transport
delays, homework/meetings/events/birthdays/emergencies. Provider-agnostic abstraction supporting
Africa's Talking, Twilio, Safaricom, Celcom. Also email, push, WhatsApp, internal messaging, notice
board.
`[BUILT: SmsProvider interface + StubSmsProvider (logs instead of calling a real gateway — no API
credentials configured for this environment), SmsMessage delivery log, manual announcement send
(ANNOUNCEMENT:SEND_TO_PARENTS, recipients picked by class → guardians), automatic payment-receipt SMS
triggered from FinanceService; PLANNED: real Africa's Talking/Twilio/Safaricom implementation
(swap-in, no call-site changes needed), email/push/WhatsApp channels, message templates, automatic
arrival/departure/absentee/discipline triggers (tied to Phase 6 biometric attendance and Phase 5
discipline modules)]`

### 4.11 Transport
Vehicles, drivers, routes, pickup points, bus attendants, trip logs, fuel/maintenance/insurance;
parent visibility of pickup/drop time and (where hardware available) live bus location; boarding/
drop notifications; driver attendance.
`[BUILT: Vehicle (with driver, a User with any role), Route (with assigned vehicle), one-route-per-
student TransportAssignment, Parent/Student-scoped visibility of their own child's route/vehicle/
driver; PLANNED: pickup points, trip logs, fuel/maintenance/insurance records, live GPS location,
boarding/drop SMS notifications (architecture supports it — same CommunicationsService pattern as
Finance/Discipline — just not wired to a trigger yet), driver attendance]`

### 4.12 Academic / Timetable
Academic year/terms/calendar, timetable, lesson planning, schemes of work, learning outcomes,
subjects/classes/streams/teacher assignment, CBC competencies. `[SCAFFOLDED: AcademicYear, SchoolClass; PLANNED — Phase 2/3: timetable, lesson planning]`

### 4.13 Attendance
Per-lesson/per-day register; only the assigned class teacher submits a class's attendance; once
submitted the record locks (only Head Teacher/Principal can reopen, with a reason, under audit).
`[BUILT: mark/lock/reopen with class-teacher-of-record + ATTENDANCE:REOPEN enforcement, audit log
entries, Parent/Student-scoped views; PLANNED: per-lesson (vs per-day) granularity, reopen reason field]`

### 4.14 Examinations & CBC Assessment
CATs, midterm, end-term, CBC competency assessments, projects, rubrics, practicals. A teacher enters
marks only for their assigned subject and cannot edit another teacher's marks. Submitted marks lock;
Academic Office can approve/reject/return-for-correction; once approved, only a Principal with
reopen-rights can unlock, under audit. Outputs: report cards, rankings, performance/grade-distribution/
subject/teacher/class/trend analysis, CBC competency reports, parent-facing report portal.
`[BUILT: Subject/SubjectAssignment model (teacher × subject × class), Exam/ExamSubject/Mark with full
DRAFT→SUBMITTED→APPROVED workflow, subject-assignment-of-record enforcement on marks entry (mirrors
the class-teacher-of-record check on attendance), EXAM:APPROVE-gated approve/reject, EXAM:REOPEN-gated
reopen, per-student report card scoped to APPROVED marks only, audit log entries; PLANNED: rankings,
grade-distribution/trend analysis, teacher/class-level analytics, printable report card layout]`

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
HR:EDIT permission from Phase 1, no new code needed); PLANNED: everything else in this section —
recruitment, contracts, appraisal, training, promotion, disciplinary actions (staff-facing, distinct
from the student Discipline module), exit management, biometric-fed staff attendance, and payroll
(payroll itself, GL, and financial statements are also called out as PLANNED under Finance §4.18)]`

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
staff-only (no student/parent visibility — inventory isn't their concern); PLANNED: purchase
requests/approvals workflow, category-specific views (kitchen/lab/ICT/uniform), a dedicated Store
Keeper role]`

### 4.22 Kitchen
Meal planning, daily menu, student meal attendance, food stock, suppliers, gas usage, cooking
schedule, nutrition reports. `[PLANNED — Phase 5]`

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
offline mode, push notifications, biometric device support, QR scanning. `[PLANNED — Phase 6]`

### 4.26 Reporting
Cross-module report generation (attendance, finance, payroll, inventory, library, transport,
academic, CBC, HR, discipline, medical, admissions, government/statutory reports), export to
PDF/Excel/CSV. `[PLANNED — incrementally per module, consolidated reporting engine in Phase 7]`

### 4.27 Audit Trail
Every mutating action logged: actor, action, timestamp, old/new value, IP, device. No hard deletes —
soft delete only. `[BUILT: soft-delete convention + AuditLog model + interceptor for core entities; PLANNED: full module coverage as modules land]`

### 4.28 AI Features
AI report-card narrative writing, performance analysis, teacher recommendations, timetable
optimization, fee-default prediction, attendance-anomaly prediction, behavioral alerts, chatbot,
academic assistant, document search. Designed as an opt-in service layer calling an LLM provider, not
a hard dependency of core workflows. `[PLANNED — Phase 6]`

## 5. Non-Functional Requirements

- **Security**: JWT auth (access + refresh), 2FA (TOTP) `[BUILT scaffold]`; face-login, encrypted
  passwords (bcrypt/argon2) `[BUILT]`; per-role permission checks server-side on every request
  `[BUILT]`; API rate limiting, device/session management `[PLANNED]`.
- **Compliance**: Kenya Data Protection Act 2019 and GDPR-aligned data handling — consent tracking,
  data export/erasure requests (soft-delete + anonymization), data residency awareness. `[PLANNED — Phase 7]`
- **Scalability**: target 100,000+ students / 10,000+ teachers across tenants; horizontal scaling of
  API via stateless JWT + Redis-backed sessions/cache/queues; connection pooling (PgBouncer) as tenant
  count grows. `[ARCHITECTURE SUPPORTS; load-tested — Phase 7]`
- **Availability**: containerized services behind a load balancer, health checks, graceful restarts;
  Kubernetes manifests for production. `[PLANNED — Phase 7]`
- **Auditability**: see 4.27.
- **Accessibility**: WCAG-conscious component choices (shadcn/ui + Radix primitives), keyboard
  navigation, dark/light mode. `[PLANNED — progressive, from Phase 2 UI work onward]`
- **Localization-ready**: Kenyan context (counties, KES currency, M-Pesa, Africa's Talking) baked into
  domain models rather than hardcoded strings, so English/Kiswahili UI copy can be added later.

## 6. Out of Scope (this SRS revision)

Boarding/hostel is explicitly listed as "future" in the source requirements — modeled as a stub
relation on Student, not built. On-device biometric SDKs and physical hardware integration are
out of scope for this codebase; only the webhook/event-ingestion side is built.
