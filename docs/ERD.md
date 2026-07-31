# Entity-Relationship Design

Two logical groups of tables, mirrored physically as **Postgres schemas**:

- **`public` schema** — platform-level, Super-Admin-owned: tenants, subscription plans, platform
  users/roles, audit log for platform actions.
- **`tenant_<slug>` schema** (one per school, created on tenant provisioning) — everything that
  belongs to a single school: users, roles/permissions, students, staff, academic structures,
  attendance, exams, finance, etc. Identical table structure across every tenant schema, applied via
  the same Prisma migration run against each schema in turn.

This document covers the entities implemented in Phase 1 in full detail, and the future-phase
entities at a lighter (name + purpose) level so the whole domain model is visible up front.

## Phase 1 entities (built)

```mermaid
erDiagram
    TENANT ||--o{ TENANT_ADMIN_LINK : "has"
    PLATFORM_USER ||--o{ TENANT_ADMIN_LINK : "administers"
    SUBSCRIPTION_PLAN ||--o{ TENANT : "assigned to"

    TENANT {
        uuid id PK
        string name
        string slug UK "used for schema name + subdomain"
        string schemaName UK
        string logoUrl
        string primaryColor
        string address
        string website
        string smsSenderId
        enum status "ACTIVE, SUSPENDED, TRIAL"
        uuid subscriptionPlanId FK
        int storageLimitMb
        datetime createdAt
        datetime deletedAt "soft delete"
    }

    SUBSCRIPTION_PLAN {
        uuid id PK
        string name
        int maxStudents
        int maxStaff
        int storageLimitMb
        decimal priceMonthly
    }

    PLATFORM_USER {
        uuid id PK
        string email UK
        string passwordHash
        string fullName
        enum platformRole "SUPER_ADMIN"
        boolean twoFactorEnabled
        datetime deletedAt
    }
```

### Within each tenant schema

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : "has"
    ROLE ||--o{ USER_ROLE : "assigned to"
    ROLE ||--o{ ROLE_PERMISSION : "grants"
    PERMISSION ||--o{ ROLE_PERMISSION : "granted by"
    USER ||--o| STUDENT : "is (if student)"
    USER ||--o| GUARDIAN_LINK : "is (if parent)"
    STUDENT ||--o{ GUARDIAN_LINK : "has guardians"
    STUDENT }o--|| GRADE_LEVEL : "enrolled in"
    STUDENT }o--o| SCHOOL_CLASS : "assigned to"
    SCHOOL_CLASS }o--|| GRADE_LEVEL : "belongs to"
    SCHOOL_CLASS }o--|| ACADEMIC_YEAR : "runs in"
    SCHOOL_CLASS }o--o| USER : "class teacher"
    AUDIT_LOG }o--|| USER : "actor"

    USER {
        uuid id PK
        string email UK
        string phone
        string passwordHash
        string fullName
        boolean twoFactorEnabled
        datetime deletedAt
    }

    ROLE {
        uuid id PK
        string name UK "e.g. SCHOOL_ADMIN, CLASS_TEACHER"
        boolean isSystemRole "seeded vs custom"
    }

    PERMISSION {
        uuid id PK
        string module "e.g. ATTENDANCE, FINANCE, EXAMS"
        string action "e.g. CREATE, READ, UPDATE, DELETE, APPROVE"
        string code UK "MODULE:ACTION, e.g. ATTENDANCE:MARK"
    }

    ROLE_PERMISSION {
        uuid roleId FK
        uuid permissionId FK
    }

    USER_ROLE {
        uuid userId FK
        uuid roleId FK
    }

    GRADE_LEVEL {
        uuid id PK
        string code "PP1, PP2, G1..G9"
        string name
        int sortOrder
    }

    ACADEMIC_YEAR {
        uuid id PK
        string name "e.g. 2026"
        date startDate
        date endDate
        boolean isCurrent
    }

    SCHOOL_CLASS {
        uuid id PK
        string name "e.g. Grade 4 Blue"
        uuid gradeLevelId FK
        uuid academicYearId FK
        uuid classTeacherId FK "nullable, -> USER"
    }

    STUDENT {
        uuid id PK
        uuid userId FK "nullable until portal account created"
        string admissionNumber UK
        string firstName
        string lastName
        date dateOfBirth
        string gender
        uuid gradeLevelId FK
        uuid currentClassId FK
        string upiNumber "nullable"
        string nemisNumber "nullable"
        enum status "ACTIVE, TRANSFERRED, GRADUATED, WITHDRAWN"
        datetime deletedAt
    }

    GUARDIAN_LINK {
        uuid id PK
        uuid studentId FK
        uuid guardianUserId FK
        string relationship "MOTHER, FATHER, GUARDIAN"
        boolean isPrimaryContact
    }

    AUDIT_LOG {
        uuid id PK
        uuid actorUserId FK
        string action
        string entityType
        string entityId
        jsonb oldValue
        jsonb newValue
        string ipAddress
        datetime createdAt
    }
```

## Phase 2 entities (built)

Added in the `phase2_attendance_homework_admissions` migration, same tenant schema, same
soft-delete/audit conventions:

- **AttendanceRecord** — `(studentId, classId, date)` unique, `status`, `markedByUserId`, `locked`
- **Assignment** — `classId`, `title`, `description`, `dueDate`, `createdByUserId`
- **Submission** — `(assignmentId, studentId)` unique, `submittedAt`, `content`, `grade`, `teacherComment`
- **Application** — admissions pipeline; `status` (Applied→Interview→Offered/Rejected/Waitlisted→Admitted),
  `admittedStudentId` (nullable FK to Student, set on admit)

## Phase 3 entities (built)

Added in the `phase3_examinations` migration:

- **Subject** — `name`, `code`
- **SubjectAssignment** — `(subjectId, classId, teacherId)` unique; who's authorized to enter marks for what
- **Exam** — `name`, `examType` (CAT/MIDTERM/ENDTERM/CBC_ASSESSMENT/PROJECT/PRACTICAL), `academicYearId`, `term`
- **ExamSubject** — `(examId, subjectId, classId)` unique; `maxScore`, `scoringMode` (NUMERIC/RUBRIC),
  `status` (DRAFT/SUBMITTED/APPROVED), `reviewComment`
- **Mark** — `(examSubjectId, studentId)` unique; `score` (numeric mode) or `rubricLevel` (EE/ME/AE/BE,
  CBC mode), `comment`, `enteredByUserId`

## Phase 4 entities (built)

Added in the `phase4_finance_communications` migration. Money amounts are whole KES (`Int`), not
`Decimal` — see model comments in schema.prisma:

- **FeeStructure** — `name`, `gradeLevelId`, `academicYearId`, `term`, `amount`
- **Invoice** — `studentId`, `feeStructureId` (nullable, for ad hoc invoices), `amount`, `balance`
  (denormalized, updated on every payment), `status` (PENDING/PARTIALLY_PAID/PAID/CANCELLED), `dueDate`
- **Payment** — `invoiceId`, `amount`, `method` (CASH/BANK/MPESA), `reference`, `receiptNumber`
  (unique, sequential `RCT-YYYY-NNNN`), `receivedByUserId`
- **MpesaStkRequest** — `invoiceId`, `phoneNumber`, `amount`, `checkoutRequestId` (unique),
  `status` (PENDING/SUCCESS/FAILED) — stub STK push; see model comment for the production
  callback-routing gap (a real Safaricom webhook needs tenant resolution from a public-schema lookup
  table, not built)
- **SmsMessage** — `recipientUserId` (nullable), `recipientPhone`, `body`, `status` (SENT/FAILED) —
  outbound log written by every `CommunicationsService` send regardless of provider outcome

## Phase 5 entities (built)

Added in the `phase5_library_transport_inventory_health_discipline_hr` migration:

- **Book** / **Loan** — `availableCopies` decremented on issue, incremented on return;
  `Loan.fineAmount` computed on return (flat KES/day-late — see LibraryService.FINE_PER_DAY)
- **Vehicle** (`driverId` → any User) / **Route** (`vehicleId` optional) / **TransportAssignment**
  (`studentId` unique — one active route per student)
- **InventoryItem** / **StockMovement** (`type` IN/OUT, `quantity` kept in sync on `InventoryItem`)
- **MedicalAlert** / **ClinicVisit** — both scoped like every other student-linked record
  (staff-wide vs. Parent's-own-child vs. Student's-own)
- **DisciplineCase** — `category` (WARNING/DETENTION/SUSPENSION/POSITIVE_BEHAVIOR); creating one
  triggers an automatic SMS to the student's primary guardian via `CommunicationsService`
- **LeaveRequest** — `requestedByUserId`/`reviewedByUserId` (any User, i.e. any staff member);
  `status` (PENDING/APPROVED/REJECTED)

## Future-phase entities (planned, not yet migrated)

| Domain | Key entities |
|---|---|
| Admissions | ApplicationDocument, InterviewSlot (scheduling beyond the status field) |
| Staff | StaffProfile, Qualification, Contract, PerformanceAppraisal (LeaveRequest is built — see Phase 5) |
| Biometric/Security | BiometricEvent, Device, VisitorLog |
| Timetable | TimetableSlot, LessonPlan, SchemeOfWork |
| CBC competency framework | LearningArea, Competency, PortfolioEvidence (see docs/SRS.md §4.15) |
| Discipline | BehaviorPoint (trend scoring beyond the case log itself) |
| Finance (GL/Payroll) | Expense, Budget, LedgerEntry, PayrollRun, Payslip, PurchaseOrder, Supplier |
| Transport | PickupPoint, TripLog, live GPS |
| Library | Reservation, barcodes/scanning |
| Kitchen | MealPlan, DailyMenu, StudentMealAttendance |
| Health | Vaccination |
| Communication (extra channels) | MessageTemplate, EmailLog, PushNotification |

Each will live in the same tenant schema, following the naming/soft-delete/audit conventions
established in Phase 1.

## Conventions

- All primary keys: UUID.
- All tables: `createdAt`, `updatedAt`, `deletedAt` (soft delete — `deletedAt IS NULL` = active).
- All mutating actions write to `AUDIT_LOG` via a Prisma middleware/interceptor, not ad hoc per
  endpoint.
- Cross-tenant foreign keys are impossible by construction — every tenant table lives in its own
  Postgres schema with no FK path to another tenant's schema.
