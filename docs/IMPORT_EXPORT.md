# Excel Import/Export

Every module below supports three actions from its list page, next to the usual "+ Add" button:

- **Template** — downloads a blank `.xlsx` with the correct column headers, a leading "Instructions" sheet, and dropdowns on any constrained column. Start here when working offline.
- **Export** — downloads the module's current data in the same format, useful as a backup or a starting point for bulk edits.
- **Import** — uploads a filled-in `.xlsx` (either the template or a previous export) and applies it.

This lets staff keep working from a spreadsheet when the system or the internet is down, and reconcile that spreadsheet back in once it's back — without risking duplicate or corrupted data.

## Rules that apply to every module

- **Never rename, remove, or reorder column headers.** The import checks the header row before reading any data; if it doesn't match exactly, the whole file is rejected with a clear message and nothing is imported.
- **All-or-nothing.** Every row in the file is validated first, collecting *every* error across the whole file — not just the first one found. If there is a single error anywhere, **nothing is imported**. Fix every listed error and re-upload the whole file. This is what makes imports safe to retry: a failed import never leaves the data half-updated.
- **A natural key decides create vs. update**, per module (see each section below). Leaving the key column blank always creates a new record. Filling in an existing key updates that record's other fields — the key itself is never changed by an import.
- **Duplicate keys within one file are rejected.** If two rows in the same upload share the same key, every one of those rows gets an error naming the conflicting row numbers.
- **Unresolvable references are rejected, never silently dropped or defaulted.** A class, grade, subject, role, or program name that doesn't match anything gets a specific row error, usually naming the valid options.
- **Passwords are never accepted from a spreadsheet.** Any module that creates a login (Staff/Users) always generates a temporary password server-side and shows it once, right after import — it is never read from the uploaded file.

## Finance-specific rules (Invoices, Payments)

Finance data is the highest-stakes import in the system, so it has extra rules on top of the ones above:

- **Amounts are always whole Kenyan Shillings.** This system does not track cents. A decimal amount (e.g. `4500.50`) is rejected, not rounded.
- **Status is never accepted from a file.** `PENDING` / `PARTIALLY_PAID` / `PAID` is always computed from real recorded amounts — an import can never claim an invoice is paid directly.
- **A payment can never create the invoice it belongs to.** The invoice must already exist (by Invoice Number) before a payment referencing it can be imported.
- **Payments are applied through the exact same logic as the manual "Record Payment" button** — an imported payment updates the invoice's balance and status exactly as if a staff member had typed it in by hand at the front desk, never a separate/parallel code path.
- **An invoice's amount is checked against its fee structure**, when one is given — a mismatch (stale or mistyped amount) is rejected rather than silently accepted.
- **Re-uploading the same payments file is safe.** A payment's `Reference` (bank slip number, M-Pesa code, etc.) is checked against every payment already recorded, imported or manual — if it's already there, that row is silently skipped rather than double-counted.

## Modules

### 1. Students (`/school/students`)

| | |
|---|---|
| Natural key | Admission Number (blank = create) |
| Required for new | First Name, Last Name, Date of Birth, Gender, Grade Level Code |
| Enums | Gender: `MALE`, `FEMALE`. Status: `ACTIVE`, `TRANSFERRED`, `GRADUATED`, `WITHDRAWN` |
| References | Grade Level Code must match an existing grade level. Current Class Name (optional) must match an existing class in the current academic year. |
| Format notes | Date of Birth is `YYYY-MM-DD`. |

### 2. Finance — Invoices (`/school/finance`)

| | |
|---|---|
| Natural key | Invoice Number (blank = create; on update, **only Due Date** can change — everything else on an existing invoice is locked once payments may exist against it) |
| Required for new | Admission Number, Academic Year, Term, Amount (KES), Due Date |
| References | Admission Number must match an existing student. Academic Year must match an existing academic year name. Fee Structure Name (optional) must match exactly, and if given, Amount must match that fee structure's amount exactly. |
| Format notes | Due Date is `YYYY-MM-DD`. Amount is whole KES only. |

### 3. Finance — Payments (`/school/finance`)

| | |
|---|---|
| Natural key | None — every row is always a new payment. Dedupe is by `Reference` (see Finance-specific rules above), not a create/update key. |
| Required | Invoice Number, Amount (KES), Method |
| Enums | Method: `CASH`, `BANK`, `MPESA` |
| References | Invoice Number must match an existing invoice. |
| Format notes | Amount is whole KES only and cannot exceed the invoice's outstanding balance. Receipt Number is generated automatically. Imported payments are timestamped at import time, not backdated. |

### 4. Attendance (`/school/attendance`)

| | |
|---|---|
| Natural key | Composite: Admission Number + Class Name + Date (matches the existing one-record-per-student-per-class-per-day rule) |
| Required | Admission Number, Class Name, Date, Status |
| Enums | Status: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED` |
| References | Admission Number must match an existing student. Class Name must match an existing class in the current academic year. |
| Format notes | Date is `YYYY-MM-DD`. A class/date that's already submitted and locked rejects every row targeting it — ask a School Administrator to reopen it first, same as the manual marking screen. |

### 5. Exams — Marks (`/school/exams`)

| | |
|---|---|
| Natural key | Admission Number, scoped to the one exam subject the template was downloaded from — re-uploading the same admission number updates that student's mark, no separate create/update choice |
| Required | Admission Number, plus Score (numeric-scored subjects) or Rubric Level (rubric-scored subjects) |
| Enums | Rubric Level: `EE`, `ME`, `AE`, `BE` |
| References | Admission Number must match an existing student. |
| Format notes | Score must be a whole number between 0 and the subject's maximum. Import is only allowed while the exam subject is `DRAFT` — blocked once submitted, exactly like manual entry. |

### 6. HR / Staff (`/school/users`)

| | |
|---|---|
| Natural key | Email (case-insensitive; blank is not allowed — every row needs an email) |
| Required for new | Email, Full Name, Roles |
| References | Roles must be one or more existing role names, comma-separated (e.g. `Class Teacher, Finance Officer`). |
| Format notes | Passwords are never read from the file — a new account gets a random temporary password shown once after import. An existing account's password is never touched by import. Phone is optional. |

### 7. Training — Trainees (`/dashboard/training/trainees`)

| | |
|---|---|
| Natural key | Trainee Number (blank = create; auto-generated for new trainees) |
| Required for new | Full Name, Gender, Program Title |
| Enums | Gender: `MALE`, `FEMALE`, `OTHER` |
| References | Program Title must match an existing training program's title exactly. |
| Format notes | Age (optional) must be a positive whole number. Filling names in ahead of time via this import lets a trainer simply mark attendance against existing names on the daily register instead of retyping them every day. |

## Where the rules live

Each module's exact rule text also ships inside its own template workbook's "Instructions" sheet — that text is the source of truth this document mirrors, so the two can't drift out of sync in practice (both are written from the same module's `*-import-instructions.ts` file).
