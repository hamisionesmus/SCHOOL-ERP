'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateSchoolDialog } from './create-school-dialog';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  address: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, logout } = useSession('platform');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiFetch<{ data: Tenant[] }>('/platform/tenants'),
    enabled: !!user,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) =>
      apiFetch(`/platform/tenants/${id}/${action}`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  if (!user) return null;

  const tenants = data?.data ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Super Admin</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Schools" value={tenants.length} />
        <StatCard label="Active" value={tenants.filter((t) => t.status === 'ACTIVE').length} />
        <StatCard label="Suspended" value={tenants.filter((t) => t.status === 'SUSPENDED').length} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Schools</CardTitle>
          <CreateSchoolDialog />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-500">No schools yet. Create the first one.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Slug</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{t.name}</td>
                    <td className="py-2 text-slate-500">{t.slug}</td>
                    <td className="py-2">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-2 text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">
                      {t.status === 'SUSPENDED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleStatus.mutate({ id: t.id, action: 'activate' })}
                        >
                          Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => toggleStatus.mutate({ id: t.id, action: 'suspend' })}
                        >
                          Suspend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
