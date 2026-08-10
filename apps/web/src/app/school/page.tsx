'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Link from 'next/link';
import {
  Users,
  Wallet,
  GraduationCap,
  MapPinned,
  ClipboardCheck,
  UserPlus,
  CalendarClock,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Sparkles,
  Compass,
  ListChecks,
  ChevronRight,
} from 'lucide-react';
import { useSession } from '@/lib/use-session';
import { apiFetch, API_ORIGIN } from '@/lib/api';
import { daysUntil, formatCountdown, countdownTone } from '@/lib/date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { mix, isValidHex, contrastTextColor } from '@/lib/theme-color';

const CHART_COLORS = ['#2563eb', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];
const DEFAULT_BRAND = '#0f172a';

interface SchoolBranding {
  name: string;
  primaryColor: string | null;
}

interface SchoolStats {
  totalStudents: number;
  boys: number;
  girls: number;
  gradeBreakdown: { grade: string; count: number }[];
  totalStaff: number;
  roleBreakdown: { role: string; count: number }[];
  pendingAdmissions: number;
}
interface FinanceStats {
  totalRevenue: number;
  totalOutstanding: number;
  collectionRatePct: number;
  invoiceStatusBreakdown: { status: string; count: number }[];
}
interface MyClassStats {
  classes: { id: string; name: string; studentCount: number }[];
  totalStudents: number;
  todayAttendanceRatePct: number | null;
  weeklyTrend: { date: string; ratePct: number | null }[];
}
interface TripSummary {
  id: string;
  title: string;
  tripDate: string;
  destination: string;
}
interface TripStats {
  upcomingApprovedCount: number;
  pendingApprovalCount: number;
  totalTripRevenue: number;
  nextTrip: TripSummary | null;
}
interface OwnChild {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  gradeLevelName: string;
  attendanceRate30dPct: number | null;
  feeBalance: number;
}
interface OwnStats {
  children: OwnChild[];
  nextTrip: TripSummary | null;
}
interface DashboardSummary {
  school?: SchoolStats;
  finance?: FinanceStats;
  myClass?: MyClassStats;
  trips?: TripStats;
  own?: OwnStats;
}

interface NotificationItem {
  id: string;
  message: string;
  href: string;
  tone: 'info' | 'warning' | 'danger';
  read: boolean;
}

const TONE_STYLE: Record<NotificationItem['tone'], { dot: string; ring: string }> = {
  danger: { dot: 'bg-rose-500', ring: 'hover:border-rose-200 hover:bg-rose-50/50' },
  warning: { dot: 'bg-amber-500', ring: 'hover:border-amber-200 hover:bg-amber-50/50' },
  info: { dot: 'bg-blue-500', ring: 'hover:border-blue-200 hover:bg-blue-50/50' },
};
const TONE_ORDER: Record<NotificationItem['tone'], number> = { danger: 0, warning: 1, info: 2 };

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export default function DashboardPage() {
  const { user } = useSession('tenant');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardSummary>('/dashboard'),
    enabled: !!user,
  });

  // Shares the ['branding'] query key with school/layout.tsx — React Query dedupes the request,
  // this just reads whatever's already in the cache (or triggers the same one fetch on cold load).
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => apiFetch<SchoolBranding>('/settings'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Shares the ['notifications'] query key with the notification bell — same computed feed,
  // rendered here as actionable cards instead of a dropdown list.
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationItem[]>('/notifications'),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  if (!user) return null;

  const firstName = user.fullName?.split(' ')[0] ?? '';
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' });
  const brand = isValidHex(branding?.primaryColor) ? branding.primaryColor : DEFAULT_BRAND;
  const brandFg = contrastTextColor(brand);

  return (
    <div className="flex flex-col gap-6">
      <header
        className="relative animate-float-up overflow-hidden rounded-2xl p-6 shadow-sm sm:p-8"
        style={{ background: `linear-gradient(120deg, ${brand}, ${mix(brand, '#000000', 0.35)})` }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20 blur-2xl"
          style={{ background: brandFg }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full opacity-10 blur-2xl"
          style={{ background: brandFg }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2 text-xs font-medium uppercase tracking-wide" style={{ color: mix(brandFg, brand, 0.25) }}>
          <Sparkles size={13} />
          {today}
        </div>
        <h1 className="relative mt-1.5 text-2xl font-semibold sm:text-[1.7rem]" style={{ color: brandFg }}>
          Welcome back, {firstName}
        </h1>
        <p className="relative mt-1 text-sm" style={{ color: mix(brandFg, brand, 0.2) }}>
          Here&apos;s what&apos;s happening at {branding?.name ?? 'your school'} today.
        </p>
      </header>

      <NeedsAttentionPanel items={notifications} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !data || Object.keys(data).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Compass size={22} />
            </div>
            <p className="text-sm text-slate-500">Nothing to show here yet — check back once your school has some activity.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {data.school && <SchoolSection data={data.school} accent={brand} />}
          {data.finance && <FinanceSection data={data.finance} />}
          {data.myClass && <MyClassSection data={data.myClass} accent={brand} />}
          {data.trips && <TripsSection data={data.trips} />}
          {data.own && <OwnSection data={data.own} accent={brand} />}
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon size={15} className="text-slate-400" />
      {children}
    </CardTitle>
  );
}

function NeedsAttentionPanel({ items }: { items: NotificationItem[] | undefined }) {
  const pending = (items ?? [])
    .filter((i) => !i.read)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

  if (pending.length === 0) return null;

  return (
    <section className="animate-float-up">
      <div className="mb-2 flex items-center gap-2">
        <ListChecks size={15} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700">Needs Your Attention</h2>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {pending.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-colors ${TONE_STYLE[item.tone].ring}`}
          >
            <span className="flex items-center gap-2.5">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${TONE_STYLE[item.tone].dot}`} />
              <span className="text-slate-700">{item.message}</span>
            </span>
            <ChevronRight size={15} className="flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function SchoolSection({ data, accent }: { data: SchoolStats; accent: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={data.totalStudents} icon={GraduationCap} accent="blue" />
        <StatCard
          label="Boys / Girls"
          value={data.boys}
          icon={Users}
          accent="violet"
          formatValue={() => `${data.boys} / ${data.girls}`}
        />
        <StatCard label="Staff Members" value={data.totalStaff} icon={Users} accent="emerald" />
        <StatCard label="Pending Admissions" value={data.pendingAdmissions} icon={UserPlus} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <SectionTitle icon={BarChart3}>Students by Grade</SectionTitle>
          </CardHeader>
          <CardContent>
            {data.gradeBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No students yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.gradeBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="grade" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="count" fill={accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle icon={PieChartIcon}>Staff by Role</SectionTitle>
          </CardHeader>
          <CardContent>
            {data.roleBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">No staff yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.roleBreakdown}
                    dataKey="count"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {data.roleBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
              {data.roleBreakdown.map((r, i) => (
                <span key={r.role} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {r.role} ({r.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function FinanceSection({ data }: { data: FinanceStats }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={data.totalRevenue}
          icon={Wallet}
          accent="emerald"
          formatValue={(n) => n.toLocaleString()}
          prefix="KES "
        />
        <StatCard
          label="Outstanding Balance"
          value={data.totalOutstanding}
          icon={Wallet}
          accent="rose"
          formatValue={(n) => n.toLocaleString()}
          prefix="KES "
        />
        <StatCard
          label="Collection Rate"
          value={data.collectionRatePct}
          icon={TrendingUp}
          accent="blue"
          suffix="%"
        />
      </div>
      {data.invoiceStatusBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle icon={BarChart3}>Invoices by Status</SectionTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.invoiceStatusBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={110} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function MyClassSection({ data, accent }: { data: MyClassStats; accent: string }) {
  if (data.classes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500">
          You aren&apos;t assigned as the class teacher for any class yet — ask your School Administrator to
          assign you one from the Classes page.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="My Students" value={data.totalStudents} icon={GraduationCap} accent="blue" />
        <StatCard
          label="Today's Attendance"
          value={data.todayAttendanceRatePct ?? 0}
          icon={ClipboardCheck}
          accent="emerald"
          suffix="%"
          hint={data.todayAttendanceRatePct === null ? 'Not marked yet today' : undefined}
        />
        <StatCard label="My Classes" value={data.classes.length} icon={Users} accent="violet" />
      </div>
      <Card>
        <CardHeader>
          <SectionTitle icon={TrendingUp}>Attendance — Last 7 Days</SectionTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => new Date(String(d)).toLocaleDateString('en-KE', { weekday: 'short' })}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(d) => new Date(String(d)).toLocaleDateString()}
                formatter={(v) => [`${v}%`, 'Present']}
              />
              <Line type="monotone" dataKey="ratePct" stroke={accent} strokeWidth={2} connectNulls dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}

function TripsSection({ data }: { data: TripStats }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming Trips" value={data.upcomingApprovedCount} icon={MapPinned} accent="violet" />
        <StatCard label="Awaiting Approval" value={data.pendingApprovalCount} icon={CalendarClock} accent="amber" />
        <StatCard
          label="Trip Revenue"
          value={data.totalTripRevenue}
          icon={Wallet}
          accent="emerald"
          formatValue={(n) => n.toLocaleString()}
          prefix="KES "
        />
      </div>
      {data.nextTrip && <NextTripCard trip={data.nextTrip} />}
    </section>
  );
}

function NextTripCard({ trip }: { trip: TripSummary }) {
  const days = daysUntil(trip.tripDate);
  const tone = countdownTone(days);
  const toneClass =
    tone === 'past'
      ? 'bg-slate-100 text-slate-500'
      : tone === 'soon'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-500">
            <MapPinned size={17} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Next Trip</p>
            <p className="mt-0.5 font-medium text-slate-900">{trip.title}</p>
            <p className="text-sm text-slate-500">{trip.destination}</p>
          </div>
        </div>
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${toneClass}`}>
          {formatCountdown(days)}
        </span>
      </CardContent>
    </Card>
  );
}

function OwnSection({ data, accent }: { data: OwnStats; accent: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.children.map((child) => (
          <Card key={child.id}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                {child.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${API_ORIGIN}${child.photoUrl}`}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-offset-2"
                    style={{ ['--tw-ring-color' as string]: accent }}
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium ring-2 ring-offset-2"
                    style={{ backgroundColor: mix(accent, '#ffffff', 0.85), color: accent, ['--tw-ring-color' as string]: accent }}
                  >
                    {child.firstName[0]}
                    {child.lastName[0]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-900">
                    {child.firstName} {child.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{child.gradeLevelName}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Attendance (30d)</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">
                    {child.attendanceRate30dPct ?? '—'}
                    {child.attendanceRate30dPct !== null && '%'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Fee Balance</p>
                  <p className={`mt-0.5 text-lg font-semibold ${child.feeBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {kes(child.feeBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {data.nextTrip && <NextTripCard trip={data.nextTrip} />}
    </section>
  );
}
