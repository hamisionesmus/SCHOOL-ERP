# Hamzone Technologies — Public API Reference for Building a Companion Website/App

**Purpose of this document:** hand this directly to Lovable (or any other AI app-builder, or a human
developer) as the spec for a *separate* marketing/lead-gen site or app that talks to the existing
Hamzone Technologies / School ERP backend. It documents exactly what's safe to call from outside the
main dashboard, what data you get back, and what you need to build first before Lovable's build will
actually work end-to-end.

The live API lives at **`https://api.myschoolapp.xyz`** (all paths below are relative to that origin).
A full interactive Swagger UI for every endpoint — public and internal — is always available at
`https://api.myschoolapp.xyz/api/docs`.

---

## 1. What this backend is (in one paragraph)

This is a multi-tenant SaaS: NestJS + PostgreSQL + Prisma, one **platform** schema holding Super
Admin/billing/CRM data, and one dedicated **tenant** schema per school. The **Hamzone CRM** (clients,
invoices, training records, marketing leads, shareable documents) lives in the platform schema and
tracks Hamzone Technologies' other product lines — training, websites, SACCO systems, hospital
systems — independent of school-ERP subscription billing. Everything a companion site needs is
either (a) a handful of **public, read-only endpoints** for showing real activity/stats, or (b) **one
public write endpoint** for submitting a lead from a contact form.

---

## 2. Before you can call anything: create an API key

Every route in this document (except the two branding/status ones marked "no key needed") requires an
`X-API-Key` header. A Super Admin creates one from **Hamzone CRM → API Keys** in the dashboard, or via:

```
POST /platform/crm/api-keys
Authorization: Bearer <super-admin JWT>
Content-Type: application/json

{ "label": "Marketing website (Lovable)", "scopes": ["training:read", "clients:read", "documents:read", "leads:write"] }

→ 201 { "key": "hz_live_9f2a1c...48-hex-chars" }
```

**The raw key is shown exactly once in that response.** Copy it immediately — only a SHA-256 hash and
a 4-character preview (`…48ab`) are stored server-side; it can never be retrieved again. If it's lost,
revoke it (`DELETE /platform/crm/api-keys/:id`) and create a new one.

Give Lovable **only the scopes it actually needs**. For a typical marketing site that's:

| Scope | Unlocks |
|---|---|
| `training:read` | Aggregate training stats (counts by track/status) — no individual trainee names |
| `clients:read` | A single number: total client count |
| `documents:read` | List of shareable documents (posters, certificates, brochures) with download URLs |
| `leads:write` | Submit a new contact-form lead — **write-only**, cannot read existing leads/clients/invoices |

Every call: `X-API-Key: hz_live_...` header, no `Bearer` prefix, no other auth needed.

**Security note for Lovable specifically:** since a marketing site's JS runs in the visitor's browser,
whatever key you give it *will* be visible to anyone who opens devtools. That's an acceptable risk
for a `leads:write`-only key (worst case: someone spams your contact form — rate-limited to 10
requests/minute per the note below) but is **not** acceptable for a key that also carries
`clients:read`/`training:read` if you'd rather those calls happen server-side. Two reasonable setups:
- **Simple (client-side calls):** one key with all four scopes, called directly from the browser. Fine
  for a low-stakes marketing site — nothing sensitive is exposed even if the key leaks (see §3).
- **Safer (server-side proxy):** Lovable's backend/edge functions hold the key; the browser talks to
  Lovable's own API, which forwards to this one. Recommended if you want to rotate the key without a
  frontend redeploy, or want your own request logging in front of it.

---

## 3. Public read endpoints (no marketing/financial data exposed)

All three intentionally expose **only aggregate or non-sensitive data** — no client contact details,
no invoice amounts, no individual trainee names, no marketing leads. Safe to display on a public page.

### `GET /public/api/v1/crm/training/overview`
Scope: `training:read`

```json
{
  "total": 42,
  "byTrack": [
    { "track": "FRONTEND", "count": 10 },
    { "track": "BACKEND", "count": 8 },
    { "track": "CODING_ROBOTICS", "count": 20 },
    { "track": "OTHER", "count": 4 }
  ],
  "byStatus": [
    { "status": "ENROLLED", "count": 12 },
    { "status": "IN_PROGRESS", "count": 15 },
    { "status": "COMPLETED", "count": 13 },
    { "status": "CANCELLED", "count": 2 }
  ]
}
```
Good for: a "42 people trained so far" stat block, a track breakdown chart.

`track` values: `FRONTEND | BACKEND | CODING_ROBOTICS | OTHER`
`status` values: `ENROLLED | IN_PROGRESS | COMPLETED | CANCELLED`

### `GET /public/api/v1/crm/clients/count`
Scope: `clients:read`

```json
{ "count": 17 }
```
Good for: a "trusted by 17+ organizations" line.

### `GET /public/api/v1/crm/documents`
Scope: `documents:read`

Returns **every** shareable document (no filtering param on the public route):
```json
[
  {
    "id": "uuid",
    "title": "Coding & Robotics — 2026 Poster",
    "category": "POSTER",
    "fileUrl": "/uploads/documents/xyz.pdf",
    "uploadedByUserId": "uuid",
    "trainingProgramId": "uuid-or-null",
    "suggestedByUserId": "uuid-or-null",
    "createdAt": "2026-01-15T09:00:00.000Z",
    "uploadedBy": { "fullName": "Jane Admin" },
    "suggestedBy": { "fullName": "John Trainer" } | null
  }
]
```
`category` values: `POSTER | CERTIFICATE | BROCHURE | OTHER`.
`fileUrl` is a relative path — prefix with `https://api.myschoolapp.xyz` to get a working download
link.
Good for: a "resources" or "brochures" section on the marketing site.

---

## 4. Public write endpoint — submit a lead from a contact form

### `POST /public/api/v1/crm/leads`
Scope: `leads:write` · **Rate-limited to 10 requests/minute** (per source, not per key)

```
POST /public/api/v1/crm/leads
X-API-Key: hz_live_...
Content-Type: application/json

{
  "clientName": "Jane Wanjiru",
  "contactPhone": "0712345678",
  "contactEmail": "jane@example.com",
  "interest": "CODING_ROBOTICS",
  "location": "Nairobi",
  "notes": "Interested in a 3-month cohort starting next term"
}
```

Required: `clientName`, `interest`. Everything else optional.

`interest` must be one of: `SCHOOL_ERP | DTP_TRAINING | CODING_ROBOTICS | WEBSITES | SACCO_SYSTEMS |
HOSPITAL_SYSTEMS | OTHER`.

**Response** (`201`): the created lead record. It appears immediately in **Hamzone CRM → Leads** in
the dashboard, tagged with `"source": "PUBLIC_API"` so admins can tell a website submission apart from
one an admin typed in manually. This is a **write-only** endpoint — the key cannot be used to list,
search, or read back leads (that stays inside the authenticated dashboard).

This is the endpoint your contact form / "Get in touch" / "Request a demo" button should call. Without
it, a marketing form has nowhere real to submit to — this is what makes the site actually *functional*
rather than just a static brochure.

---

## 5. Public branding + status endpoints (no API key needed at all)

These have no auth at all — they're meant to be fetched from anywhere, including build time.

### `GET /public/branding`
Returns the platform's current login-page branding (useful if you want the marketing site's visual
identity to automatically match the product):
```json
{
  "systemName": "School ERP",
  "loginTagline": "string|null",
  "loginLogoUrl": "/uploads/branding/logo.png",
  "faviconUrl": "/uploads/branding/favicon.ico",
  "builtByText": "string|null"
}
```

---

## 6. Everything else is intentionally NOT public

For completeness/trust — here's what a companion site **cannot** and **should not** try to reach,
because it's either sensitive or requires a real human login:

- Client contact details, invoices, payments, revenue — always behind a Super Admin/Assistant Super
  Admin JWT (`/platform/finance/*`, `/platform/crm/clients/*`, `/platform/crm/invoices/*`).
- Reading existing marketing leads — the `leads:write` scope is intentionally one-directional.
- School data of any kind (students, attendance, exams, fees) — always tenant-schema-scoped and
  requires a school login (`POST /auth/login` with a `tenantSlug`).
- Creating schools, admins, or API keys — Super Admin only, JWT-authenticated.

If a future product genuinely needs one of these opened up publicly, that's a real conversation about
scope and risk — not something to route around by reusing an existing key more broadly than it's
labeled for.

---

## 7. If you need real user login (not just marketing)

Only relevant if the "separate entity for the online work" mentioned elsewhere ends up needing actual
logged-in users (e.g. a trainer or outreach-worker mobile app) rather than just a public marketing
site. That flow is JWT-based, not API-key-based:

```
POST /auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "...", "tenantSlug": "optional-school-slug" }

→ 200
{
  "accessToken": "<JWT, ~15 min expiry>",
  "refreshToken": "<JWT, ~7 day expiry>",
  "user": {
    "sub": "uuid",
    "realm": "platform" | "tenant",
    "fullName": "string",
    "email": "string",
    "role": "SUPER_ADMIN | ASSISTANT_SUPER_ADMIN | SUB_ADMIN | TRAINER | GIG_WORKER (platform realm only)",
    "roles": ["string"],
    "permissions": ["string"],
    "tenantSchema": "string (tenant realm only)",
    "tenantSlug": "string (tenant realm only)"
  }
}
```
Omit `tenantSlug` to authenticate against the platform (Super Admin / Sub Admin / Trainer / Gig
Worker accounts all live there). Send the access token as `Authorization: Bearer <accessToken>` on
every subsequent request; call `POST /auth/refresh` with `{ "refreshToken": "..." }` when it expires
to get a new pair without forcing a re-login.

The Training/Meetings/Outreach modules already have a full REST surface under `/platform/training/*`,
`/platform/meetings/*`, and `/platform/outreach/*` (see the live Swagger UI at `/api/docs` for the
complete, current list — trainers self-serve their own registers/reports/contracts via `/mine`-suffixed
routes, so a future dedicated trainer app has everything it needs already built).

---

## 8. HTTP status codes you'll see

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | A new resource was created (e.g. a submitted lead) |
| `400 Bad Request` | Validation failed — check which field in the response body |
| `401 Unauthorized` | Missing/invalid `X-API-Key`, or a JWT is missing/expired |
| `403 Forbidden` | Authenticated, but this key/role doesn't have the required scope |
| `404 Not Found` | The resource — or the route itself — doesn't exist |
| `429 Too Many Requests` | Rate-limited (leads endpoint: 10/min) — back off and retry |
| `500 Internal Server Error` | Something broke server-side; safe to retry, report if it repeats |

---

## 9. A minimal working example (vanilla fetch, drop into any Lovable page)

```html
<script>
const API = 'https://api.myschoolapp.xyz';
const API_KEY = 'hz_live_...'; // scoped to leads:write (+ read scopes if this page also shows stats)

async function submitLead(form) {
  const res = await fetch(`${API}/public/api/v1/crm/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      clientName: form.name,
      contactEmail: form.email,
      contactPhone: form.phone,
      interest: form.interest, // one of the enum values in §4
      notes: form.message,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

async function loadStats() {
  const [training, clients] = await Promise.all([
    fetch(`${API}/public/api/v1/crm/training/overview`, { headers: { 'X-API-Key': API_KEY } }).then((r) => r.json()),
    fetch(`${API}/public/api/v1/crm/clients/count`, { headers: { 'X-API-Key': API_KEY } }).then((r) => r.json()),
  ]);
  return { totalTrained: training.total, totalClients: clients.count };
}
</script>
```

---

*Generated for the "give it to Lovable" request — kept in `docs/LOVABLE_API_REFERENCE.md` and linked
from the in-app API docs page (`/dashboard/api-docs`) so it stays discoverable. Update this file
whenever a new public scope/endpoint is added — it's meant to always reflect exactly what's safe to
hand to a third-party builder, nothing more.*
