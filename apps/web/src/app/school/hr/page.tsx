'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolNav } from '@/components/school-nav';

interface UserRef {
  id: string;
  fullName: string;
  email: string;
}
interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: UserRef;
}

export default function HrPage() {
  const { user, logout } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReview = user?.permissions?.includes('HR:EDIT');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => apiFetch<LeaveRequest[]>('/hr/leave-requests'),
    enabled: !!user,
  });

  const createRequest = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/hr/leave-requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveType: fd.get('leaveType'),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          reason: fd.get('reason') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to submit request'),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiFetch(`/hr/leave-requests/${id}/${action}`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  });

  if (!user) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <SchoolNav user={user} onLogout={logout} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{canReview ? 'Leave requests' : 'My leave requests'}</CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Request leave'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createRequest.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
            >
              <select name="leaveType" required className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="">Leave type</option>
                <option value="Annual">Annual</option>
                <option value="Sick">Sick</option>
                <option value="Maternity">Maternity</option>
                <option value="Paternity">Paternity</option>
                <option value="Compassionate">Compassionate</option>
              </select>
              <Input name="startDate" type="date" required />
              <Input name="endDate" type="date" required />
              <Input name="reason" placeholder="Reason (optional)" className="col-span-2" />
              {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
              <div className="col-span-2">
                <Button type="submit" disabled={createRequest.isPending}>
                  {createRequest.isPending ? 'Submitting...' : 'Submit request'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !requests || requests.length === 0 ? (
            <p className="text-sm text-slate-500">No leave requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {r.leaveType}
                        {canReview && <span className="text-slate-500"> — {r.requestedBy.fullName}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                        {r.reason && ` · ${r.reason}`}
                      </p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  {canReview && r.status === 'PENDING' && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => review.mutate({ id: r.id, action: 'approve' })}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => review.mutate({ id: r.id, action: 'reject' })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
