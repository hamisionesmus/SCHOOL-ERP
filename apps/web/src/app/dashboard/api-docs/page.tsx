'use client';

import { Download, ExternalLink } from 'lucide-react';
import { API_ORIGIN } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
      <code>{children}</code>
    </pre>
  );
}

const STACK = [
  { layer: 'Backend framework', tech: 'NestJS (Node.js + TypeScript)', why: 'Structured, dependency-injected modules keep ~40 feature areas (schools, finance, tickets, CRM, etc.) organized instead of one giant codebase; TypeScript catches whole classes of bugs before they ship.' },
  { layer: 'Database', tech: 'PostgreSQL, schema-per-tenant', why: 'Every school gets its own Postgres schema (real data isolation — one school can never query another’s rows) inside one shared database cluster, avoiding the ops overhead of a separate database per school while still giving strong isolation.' },
  { layer: 'ORM', tech: 'Prisma', why: 'Type-safe database access generated straight from the schema — the same model definitions produce both the runtime client and the migration files, so the code and the database can never silently drift apart.' },
  { layer: 'Frontend framework', tech: 'Next.js 14 (App Router) + React + TypeScript', why: 'Server-rendered pages load fast, client-side navigation feels instant afterwards, and the same language (TypeScript) runs on both ends of the stack.' },
  { layer: 'Styling', tech: 'Tailwind CSS', why: 'Utility classes keep every page visually consistent without a separate design-token system to maintain.' },
  { layer: 'Data fetching', tech: 'TanStack React Query', why: 'Automatic caching, background refresh, and request de-duplication — the dashboard feels live without every page hand-rolling polling logic.' },
  { layer: 'Auth', tech: 'JWT (short-lived access token + refresh token), bcrypt password hashing', why: 'Stateless access tokens scale without a server-side session store; refresh tokens are rotated and revocable, and passwords are never stored or logged in plain text.' },
  { layer: 'Real-time', tech: 'Socket.IO (WebSockets)', why: 'Powers live ticket chat and the "who’s online" presence dashboard — a push mechanism that polling can only approximate on a delay.' },
  { layer: 'Background jobs', tech: '@nestjs/schedule (cron)', why: 'Drives hourly backups, daily reminder emails/SMS, and scheduled campaign dispatch without a separate job-queue service.' },
  { layer: 'PDF generation', tech: 'PDFKit', why: 'Report cards, payslips, and invoices are generated as real PDF files server-side, on demand, with the school’s or Hamzone’s own branding.' },
  { layer: 'Email', tech: 'SMTP (self-hosted relay) / Resend, with a log-only fallback', why: 'Real deliverability in production; falls back to a safe no-op in local development so nothing breaks without credentials configured.' },
  { layer: 'SMS', tech: 'Advanta SMS', why: 'Kenyan SMS gateway used for OTPs, reminders, and campaign messages, with the same safe local-dev fallback as email.' },
  { layer: 'Payments', tech: 'Safaricom Daraja (M-Pesa STK Push)', why: 'The dominant payment method in Kenya — schools and clients get a phone-prompt payment experience instead of manual bank transfers wherever possible.' },
  { layer: 'Deployment', tech: 'Docker Compose behind Caddy (automatic HTTPS)', why: 'Every service (API, web, database, mail relay, reverse proxy) runs as its own container, rebuilt and redeployed automatically by GitHub Actions on every push to main.' },
];

const STATUS_CODES = [
  { code: '200 OK', meaning: 'Request succeeded.' },
  { code: '201 Created', meaning: 'A new resource was created.' },
  { code: '204 No Content', meaning: 'Succeeded, nothing to return (e.g. a delete).' },
  { code: '400 Bad Request', meaning: 'Validation failed — check the response body for which field.' },
  { code: '401 Unauthorized', meaning: 'Missing/expired token, or an invalid API key.' },
  { code: '403 Forbidden', meaning: 'Authenticated, but this role/key can’t do that.' },
  { code: '404 Not Found', meaning: 'The resource (or the route itself) doesn’t exist.' },
  { code: '429 Too Many Requests', meaning: 'Rate-limited — back off and retry after a short delay.' },
  { code: '500 Internal Server Error', meaning: 'Something broke server-side; safe to retry, and if it repeats, report it.' },
];

export default function ApiDocsPage() {
  const swaggerUrl = `${API_ORIGIN}/api/docs`;

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">API &amp; Architecture</h1>
        <p className="text-sm text-slate-500">How the system is built, and how to integrate with it from the outside.</p>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Live, interactive API reference</CardTitle>
              <CardDescription>
                Every authenticated endpoint in the system, auto-generated from the actual code — request/response shapes,
                try-it-out, the works.
              </CardDescription>
            </div>
            <a href={swaggerUrl} target="_blank" rel="noreferrer">
              <Button className="gap-1.5">
                Open Swagger UI <ExternalLink size={14} />
              </Button>
            </a>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Architecture, in plain terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              This is a multi-tenant SaaS: one <strong>platform</strong> database schema holds Super Admin/billing/CRM data, and
              every school gets its own dedicated <strong>tenant</strong> schema (attendance, exams, finance, students, staff —
              nothing from one school is ever queryable from another). A school is identified by its subdomain slug at login,
              which resolves to its schema for the rest of that session.
            </p>
            <p>
              The <strong>Hamzone CRM</strong> (Clients, Invoices, Training, Marketing Leads, Documents) lives in the platform
              schema too, but is a completely separate business concern from the school-ERP subscription billing — it tracks
              Hamzone Technologies&apos; other product lines (training, websites, SACCO systems, hospital systems), and its
              revenue is combined with school-subscription revenue only in the one company-wide finance total.
            </p>
            <p>
              Requests flow: <strong>Next.js</strong> (browser) → <strong>NestJS API</strong> (JWT-guarded, role/permission
              checked per route) → <strong>Prisma</strong> → <strong>PostgreSQL</strong>. Outbound email/SMS/PDF/payment calls
              all go through small provider interfaces (one file per integration), so swapping a provider later never touches
              the rest of the codebase.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tech stack — what, and why</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STACK.map((s) => (
                <div key={s.layer} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-900">
                    {s.layer} — <span className="font-normal text-slate-600">{s.tech}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{s.why}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Authenticating your own requests (JWT)</CardTitle>
            <CardDescription>Every dashboard-facing endpoint uses this — the same tokens the browser holds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CodeBlock>{`POST ${API_ORIGIN}/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "...", "slug": "your-school-slug" }

→ 200 { "accessToken": "...", "refreshToken": "...", "user": { ... } }`}</CodeBlock>
            <p className="text-sm text-slate-600">
              Send the access token on every subsequent request as <code>Authorization: Bearer &lt;accessToken&gt;</code>. It
              expires quickly (15 minutes); call <code>POST /auth/refresh</code> with the refresh token to get a new pair
              without asking the user to log in again.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Third-party integration (no login required)</CardTitle>
            <CardDescription>
              For external systems — like the public hamzonetechnologies.com website — that need to read select CRM data
              without a human session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Create a scoped API key from <strong>Hamzone CRM → API Keys</strong> (Super Admin only), then call:
            </p>
            <CodeBlock>{`GET ${API_ORIGIN}/public/api/v1/crm/training/overview
X-API-Key: hz_live_...

GET ${API_ORIGIN}/public/api/v1/crm/clients/count
X-API-Key: hz_live_...

GET ${API_ORIGIN}/public/api/v1/crm/documents
X-API-Key: hz_live_...`}</CodeBlock>
            <p className="text-sm text-slate-600">
              Each key is scoped to exactly what it needs (<code>training:read</code>, <code>clients:read</code>,{' '}
              <code>documents:read</code>, <code>leads:write</code>) and can be revoked instantly if it&apos;s ever
              compromised. The read scopes are intentionally read-only and never expose client contact details,
              invoices, or marketing leads; <code>leads:write</code> is one-directional — it can submit a new lead
              (e.g. from a contact form) but can never read leads back.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Building a companion site or app (e.g. with Lovable)</CardTitle>
              <CardDescription>
                A self-contained reference — public endpoints, request/response shapes, API-key setup, a working code
                sample — sized to hand directly to Lovable or any other AI app-builder.
              </CardDescription>
            </div>
            <a href="/lovable-api-reference.md" download="hamzone-api-reference.md">
              <Button className="gap-1.5">
                Download reference <Download size={14} />
              </Button>
            </a>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">HTTP status codes you&apos;ll see</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {STATUS_CODES.map((s) => (
                  <tr key={s.code} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs font-medium text-slate-900">{s.code}</td>
                    <td className="py-1.5 text-slate-600">{s.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
