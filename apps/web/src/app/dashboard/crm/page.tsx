'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users2, Receipt, GraduationCap, Radar, FolderKanban, KeyRound, ListChecks } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';

interface TrainingOverview {
  total: number;
}

interface StaffTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  hamzoneClient: { id: string; name: string } | null;
  hamzoneLead: { id: string; clientName: string } | null;
}

const NEXT_STATUS: Record<StaffTask['status'], StaffTask['status']> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
};

function MyTasksTodayWidget() {
  const queryClient = useQueryClient();

  const { data: tasks } = useQuery({
    queryKey: ['staff-tasks-mine'],
    queryFn: () => apiFetch<StaffTask[]>('/platform/staff-tasks/mine'),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StaffTask['status'] }) =>
      apiFetch(`/platform/staff-tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tasks-mine'] });
      notifySuccess('Task updated');
    },
    onError: (err) => notifyError(err, 'Failed to update task'),
  });

  const now = new Date();
  const dueTasks = (tasks ?? [])
    .filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) <= now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  if (dueTasks.length === 0) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks size={16} className="text-slate-400" />
          My Tasks Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {dueTasks.map((t) => {
            const linked = t.hamzoneClient
              ? { href: `/dashboard/crm/clients/${t.hamzoneClient.id}`, label: t.hamzoneClient.name }
              : t.hamzoneLead
                ? { href: '/dashboard/crm/leads', label: t.hamzoneLead.clientName }
                : null;
            const overdue = t.dueDate && new Date(t.dueDate) < now;
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {linked && (
                      <Link href={linked.href} className="hover:underline">
                        {linked.label}
                      </Link>
                    )}
                    {linked && ' · '}
                    <span className={overdue ? 'font-medium text-rose-600' : ''}>
                      Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setStatus.mutate({ id: t.id, status: NEXT_STATUS[t.status] })}
                  disabled={setStatus.isPending}
                  className="whitespace-nowrap rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                >
                  {t.status.replace(/_/g, ' ')} →
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

const SECTIONS = [
  { href: '/dashboard/crm/clients', label: 'Clients', description: 'Every Hamzone client — schools, businesses, individuals — across all product lines.', icon: Users2 },
  { href: '/dashboard/crm/invoices', label: 'Invoices', description: 'Company invoices with VAT, sent by email/SMS, tracked to payment.', icon: Receipt },
  { href: '/dashboard/crm/training', label: 'Training', description: 'Frontend, backend, and Coding & Robotics trainees.', icon: GraduationCap },
  { href: '/dashboard/crm/leads', label: 'Marketing Leads', description: 'Real-time leads submitted from the field.', icon: Radar },
  { href: '/dashboard/crm/documents', label: 'Documents', description: 'Posters, certificates, brochures — shareable company files.', icon: FolderKanban },
];

export default function CrmOverviewPage() {
  const isSuperAdmin = getSessionUser()?.role === 'SUPER_ADMIN';

  const { data: clients } = useQuery({
    queryKey: ['crm-clients-count'],
    queryFn: () => apiFetch<{ meta: { total: number } }>('/platform/crm/clients?pageSize=1'),
  });
  const { data: training } = useQuery({
    queryKey: ['crm-training-overview'],
    queryFn: () => apiFetch<TrainingOverview>('/platform/crm/training/overview'),
  });
  const { data: leads } = useQuery({
    queryKey: ['crm-leads-new-count'],
    queryFn: () => apiFetch<{ meta: { total: number } }>('/platform/crm/leads?status=NEW&pageSize=1'),
  });
  const { data: invoices } = useQuery({
    queryKey: ['crm-invoices-count'],
    queryFn: () => apiFetch<{ meta: { total: number } }>('/platform/crm/invoices?pageSize=1'),
  });

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Hamzone CRM</h1>
        <p className="text-sm text-slate-500">
          Company-wide clients, invoicing, training, and marketing — separate from the school ERP&apos;s own billing, but the
          same company.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clients" value={clients?.meta.total ?? 0} icon={Users2} accent="blue" />
        <StatCard label="Invoices raised" value={invoices?.meta.total ?? 0} icon={Receipt} accent="emerald" />
        <StatCard label="Trainees" value={training?.total ?? 0} icon={GraduationCap} accent="violet" />
        <StatCard label="New leads" value={leads?.meta.total ?? 0} icon={Radar} accent="amber" />
      </div>

      <MyTasksTodayWidget />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <s.icon size={20} className="mb-1 text-slate-500" />
                <CardTitle className="text-base">{s.label}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        {isSuperAdmin && (
          <Link href="/dashboard/crm/api-keys">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <KeyRound size={20} className="mb-1 text-slate-500" />
                <CardTitle className="text-base">API Keys</CardTitle>
                <CardDescription>Let the company website or other systems pull select CRM data.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        )}
      </div>
    </>
  );
}
