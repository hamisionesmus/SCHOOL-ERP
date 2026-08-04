'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserX, Radio, ChevronDown, ChevronRight, History } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';
import { onPresenceSnapshot, PresenceSnapshot, PresenceEntry } from '@/lib/presence-socket';

interface SessionHistoryEntry {
  id: string;
  realm: 'platform' | 'tenant';
  fullName: string;
  role: string | null;
  roles: string[] | null;
  tenantSlug: string | null;
  schoolName: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
  activities: { path: string; occurredAt: string }[];
}

function formatDuration(startIso: string, endIso: string | null) {
  const ms = (endIso ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function SessionRow({ session }: { session: SessionHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const subtitle =
    session.realm === 'platform'
      ? (session.role ?? 'Platform team')
      : `${session.roles?.join(', ') || 'Staff'} — ${session.schoolName ?? session.tenantSlug ?? 'Unknown school'}`;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-slate-50"
      >
        {open ? <ChevronDown size={14} className="flex-shrink-0 text-slate-400" /> : <ChevronRight size={14} className="flex-shrink-0 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-800">{session.fullName}</span>
            <span className="truncate text-xs text-slate-400">— {subtitle}</span>
          </div>
          <p className="text-xs text-slate-400">
            {new Date(session.connectedAt).toLocaleString()}
            {session.disconnectedAt ? ` → ${new Date(session.disconnectedAt).toLocaleTimeString()}` : ''}
            {' · '}
            {formatDuration(session.connectedAt, session.disconnectedAt)}
            {' · '}
            {session.activities.length} page{session.activities.length === 1 ? '' : 's'} visited
          </p>
        </div>
        {!session.disconnectedAt && (
          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Still online
          </span>
        )}
      </button>
      {open && (
        <div className="ml-6 mb-2 flex flex-col gap-0.5 border-l border-slate-200 pl-3">
          {session.activities.length === 0 ? (
            <p className="text-xs text-slate-400">No page visits recorded for this session.</p>
          ) : (
            session.activities.map((a, i) => (
              <p key={i} className="text-xs text-slate-500">
                <span className="text-slate-400">{new Date(a.occurredAt).toLocaleTimeString()}</span> — {a.path}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function PersonRow({ entry }: { entry: PresenceEntry }) {
  const subtitle = entry.realm === 'platform' ? (entry.role ?? 'Platform team') : (entry.roles?.join(', ') || 'Staff');
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-slate-50">
      <LiveDot />
      <span className="truncate text-sm font-medium text-slate-800">{entry.fullName}</span>
      <span className="truncate text-xs text-slate-400">— {subtitle}</span>
    </div>
  );
}

// Real-time proof of who's actually using the system, and when — countering "we don't use it"
// claims from a school. Live via the same app-wide presence socket every layout already opens (see
// usePresenceOnline in dashboard/layout.tsx and school/layout.tsx); GET /platform/presence is only
// the initial-load/fallback snapshot before the first broadcast arrives.
export default function PresencePage() {
  useRequireFinanceAccess();

  const { data: initial, isLoading } = useQuery({
    queryKey: ['presence-snapshot'],
    queryFn: () => apiFetch<PresenceSnapshot>('/platform/presence'),
  });
  const [snapshot, setSnapshot] = useState<PresenceSnapshot | undefined>(undefined);

  useEffect(() => onPresenceSnapshot(setSnapshot), []);

  const historyQuery = useQuery({
    queryKey: ['presence-history'],
    queryFn: () => apiFetch<SessionHistoryEntry[]>('/platform/presence/history?hours=24'),
    refetchInterval: 60_000,
  });

  const data = snapshot ?? initial;

  const platformTeam = (data?.online ?? []).filter((e) => e.realm === 'platform');
  const bySchool = new Map<string, PresenceEntry[]>();
  for (const e of data?.online ?? []) {
    if (e.realm !== 'tenant') continue;
    const label = e.schoolName ?? e.tenantSlug ?? 'Unknown school';
    if (!bySchool.has(label)) bySchool.set(label, []);
    bySchool.get(label)!.push(e);
  }
  const schoolGroups = Array.from(bySchool.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Who&apos;s Online</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real-time — updates the instant someone logs in, logs out, or closes their browser. No
          refresh needed.
        </p>
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Online now" value={data?.onlineNow ?? 0} icon={UserCheck} accent="emerald" />
            <StatCard label="Offline now" value={data?.offlineNow ?? 0} icon={UserX} accent="slate" />
            <StatCard label="Total users" value={data?.totalUsers ?? 0} icon={Users} accent="blue" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radio size={16} className="text-emerald-500" />
                Platform team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformTeam.length === 0 ? (
                <p className="text-sm text-slate-400">Nobody from the platform team is online right now.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {platformTeam.map((e) => (
                    <PersonRow key={e.userId} entry={e} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schools</CardTitle>
            </CardHeader>
            <CardContent>
              {schoolGroups.length === 0 ? (
                <p className="text-sm text-slate-400">No school staff or parents are online right now.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {schoolGroups.map(([school, entries]) => (
                    <div key={school}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {school} · {entries.length} online
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {entries.map((e) => (
                          <PersonRow key={e.userId} entry={e} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History size={16} className="text-slate-400" />
                Last 24 hours
              </CardTitle>
              <CardDescription>
                Every session in the last day, who was online, when, and which pages they visited —
                including people now offline. Click a row to see the pages they visited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : !historyQuery.data || historyQuery.data.length === 0 ? (
                <p className="text-sm text-slate-400">No sessions in the last 24 hours.</p>
              ) : (
                <div className="flex flex-col">
                  {historyQuery.data.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
