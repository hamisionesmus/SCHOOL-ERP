'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users2, Receipt, GraduationCap, Radar, FolderKanban, KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';

interface TrainingOverview {
  total: number;
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
