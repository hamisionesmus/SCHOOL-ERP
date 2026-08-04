'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserX, Radio } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';
import { onPresenceSnapshot, PresenceSnapshot, PresenceEntry } from '@/lib/presence-socket';

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
        </>
      )}
    </div>
  );
}
