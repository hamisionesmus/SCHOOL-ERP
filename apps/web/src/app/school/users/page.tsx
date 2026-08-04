'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';
import { SortableTh } from '@/components/ui/sortable-th';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { useDraftState } from '@/hooks/use-draft-state';

interface Role {
  id: string;
  name: string;
  description: string;
}
interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  userRoles: { role: Role }[];
}

type StaffDraft = { fullName: string; email: string; selectedRoleIds: string[] };

export default function UsersPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadDraft, saveDraft, clearDraft } = useDraftState<StaffDraft>('users-staff');
  const draft = loadDraft();
  const [fullName, setFullName] = useState(draft?.fullName ?? '');
  const [email, setEmail] = useState(draft?.email ?? '');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(draft?.selectedRoleIds ?? []);
  const [search, setSearch] = useState('');

  useEffect(() => {
    saveDraft({ fullName, email, selectedRoleIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, email, selectedRoleIds]);

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<Role[]>('/roles'),
    enabled: !!user,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<StaffUser[]>('/users'),
    enabled: !!user,
  });

  const createUser = useMutation({
    mutationFn: (password: FormDataEntryValue | null) =>
      apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password, roleIds: selectedRoleIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setError(null);
      setFullName('');
      setEmail('');
      setSelectedRoleIds([]);
      clearDraft();
      notifySuccess('Staff member added');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add staff member');
      notifyError(err, 'Failed to add staff member');
    },
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.userRoles.some((r) => r.role.name.toLowerCase().includes(q)),
    );
  }, [users, search]);

  const table = useTableControls(filtered, { pageSize: 10, initialSortKey: 'fullName' });

  if (!user) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Staff</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add staff'}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedRoleIds.length === 0) {
                setError('Select at least one role');
                return;
              }
              createUser.mutate(new FormData(e.currentTarget).get('password'));
            }}
            className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
          >
            <div className="grid grid-cols-2 gap-3">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required />
              <Input name="password" type="password" placeholder="Temporary password" minLength={8} required className="col-span-2" />
            </div>

            <p className="text-xs font-medium uppercase text-slate-400">
              Roles — teaching staff (Class Teacher), non-teaching staff, or any other role
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3">
              {roles?.map((r) => (
                <label key={r.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={(e) =>
                      setSelectedRoleIds((prev) =>
                        e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                      )
                    }
                  />
                  <span>
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="block text-xs text-slate-400">{r.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? 'Saving...' : 'Save staff member'}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-slate-500">No staff yet.</p>
        ) : (
          <>
            <div className="relative mb-3 max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="pl-8"
              />
            </div>
            {table.pageItems.length === 0 ? (
              <p className="text-sm text-slate-500">No staff match &quot;{search}&quot;.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <SortableTh label="Name" active={table.sortKey === 'fullName'} dir={table.sortDir} onClick={() => table.toggleSort('fullName')} />
                    <SortableTh label="Email" active={table.sortKey === 'email'} dir={table.sortDir} onClick={() => table.toggleSort('email')} />
                    <th className="py-2 font-medium">Roles</th>
                    <SortableTh label="Status" active={table.sortKey === 'isActive'} dir={table.sortDir} onClick={() => table.toggleSort('isActive')} />
                  </tr>
                </thead>
                <tbody>
                  {table.pageItems.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-900">{u.fullName}</td>
                      <td className="py-2 text-slate-500">{u.email}</td>
                      <td className="py-2 text-slate-500">
                        {u.userRoles.map((r) => r.role.name).join(', ') || <span className="text-slate-300">None</span>}
                      </td>
                      <td className="py-2">
                        <span
                          className={
                            u.isActive
                              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
                              : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600'
                          }
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination
              page={table.page}
              pageCount={table.pageCount}
              totalItems={table.totalItems}
              pageSize={table.pageSize}
              onPageChange={table.setPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
