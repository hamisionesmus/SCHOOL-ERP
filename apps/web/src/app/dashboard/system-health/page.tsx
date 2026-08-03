'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Cpu, MemoryStick, HardDrive, School, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useRequireFinanceAccess } from '@/lib/require-super-admin';

interface SystemHealth {
  cpu: { cores: number; loadAvg1m: number };
  memory: { totalMb: number; freeMb: number; usedPct: number };
  disk: { totalMb: number; freeMb: number; usedPct: number };
  schools: {
    count: number;
    totalStorageMb: number;
    avgStorageMbPerSchool: number;
    estimatedRemainingCapacity: number | null;
  };
  dailyActiveLogins: { date: string; count: number }[];
}

function mb(n: number) {
  if (n >= 1024) return `${(n / 1024).toFixed(1)} GB`;
  return `${Math.round(n)} MB`;
}

// System Health shares the exact same visibility rule as Finance (Super Admin + Assistant Super
// Admin, Sub-Admin excluded) — see useRequireFinanceAccess's own doc comment for the backend gate
// this mirrors.
export default function SystemHealthPage() {
  useRequireFinanceAccess();

  const { data, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiFetch<SystemHealth>('/platform/system-health'),
    refetchInterval: 30_000,
  });

  const capacityText =
    data?.schools.estimatedRemainingCapacity === null
      ? 'Not enough schools yet to estimate — this fills in once there are at least a couple of real schools to average from.'
      : data
        ? `At current usage, this server can comfortably support ~${data.schools.estimatedRemainingCapacity} more school${data.schools.estimatedRemainingCapacity === 1 ? '' : 's'} like your existing ones, based on free disk space and average storage per school. CPU and RAM are shown below but aren't part of this estimate — load is bursty and harder to model simply, while disk is the steady, predictable constraint.`
        : '';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">System Health</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real server capacity — CPU, memory, disk, and how much room is left for more schools.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard
              label="CPU load (1 min)"
              value={data.cpu.loadAvg1m}
              icon={Cpu}
              accent="blue"
              hint={`${data.cpu.cores} core${data.cpu.cores === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Memory used"
              value={data.memory.usedPct}
              suffix="%"
              icon={MemoryStick}
              accent="violet"
              hint={`${mb(data.memory.totalMb - data.memory.freeMb)} of ${mb(data.memory.totalMb)}`}
            />
            <StatCard
              label="Disk used"
              value={data.disk.usedPct}
              suffix="%"
              icon={HardDrive}
              accent="amber"
              hint={`${mb(data.disk.totalMb - data.disk.freeMb)} of ${mb(data.disk.totalMb)}`}
            />
            <StatCard label="Schools" value={data.schools.count} icon={School} accent="emerald" hint={`avg ${mb(data.schools.avgStorageMbPerSchool)} each`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacity outlook</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">{capacityText}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users size={16} className="text-slate-400" />
                Daily active logins — last 7 days
              </CardTitle>
              <CardDescription>
                Distinct successful logins per day, across every school and the platform team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dailyActiveLogins} margin={{ left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short' })}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
