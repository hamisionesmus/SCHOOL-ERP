'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { daysUntil, formatCountdown, countdownTone } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface UserRef {
  id: string;
  fullName: string;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
}
interface TripPayment {
  id: string;
  amount: number;
  receiptNumber: string;
}
interface TripRegistration {
  id: string;
  tripId: string;
  studentId: string;
  status: 'UNPAID' | 'PAID';
  student: Student;
  payments?: TripPayment[];
}
interface Trip {
  id: string;
  title: string;
  description: string | null;
  destination: string;
  tripDate: string;
  costPerStudent: number;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  proposedBy: UserRef;
  approvedBy: UserRef | null;
  rejectionReason: string | null;
  registrations?: TripRegistration[];
}

function CountdownBadge({ tripDate }: { tripDate: string }) {
  const days = daysUntil(tripDate);
  const tone = countdownTone(days);
  const toneClass =
    tone === 'past'
      ? 'bg-slate-100 text-slate-500'
      : tone === 'soon'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>
      {formatCountdown(days)}
    </span>
  );
}

export default function TripsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerStudentId, setRegisterStudentId] = useState<Record<string, string>>({});
  const [reviewTarget, setReviewTarget] = useState<{ id: string; title: string; action: 'approve' | 'reject' } | null>(
    null,
  );

  const perms = user?.permissions ?? [];
  const canPropose = perms.includes('TRANSPORT:PROPOSE');
  const canManage = perms.includes('TRANSPORT:MANAGE');
  const canRegister = perms.includes('STUDENT:VIEW_OWN_CHILD') || perms.includes('STUDENT:VIEW_OWN_RECORD');

  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => apiFetch<Trip[]>('/trips'),
    enabled: !!user,
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && canRegister,
  });
  const { data: myRegistrations } = useQuery({
    queryKey: ['trip-registrations'],
    queryFn: () => apiFetch<TripRegistration[]>('/trips/registrations'),
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['trips'] });
    queryClient.invalidateQueries({ queryKey: ['trip-registrations'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const propose = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/trips', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          description: fd.get('description') || undefined,
          destination: fd.get('destination'),
          tripDate: fd.get('tripDate'),
          costPerStudent: Number(fd.get('costPerStudent')),
        }),
      }),
    onSuccess: (_data, fd) => {
      invalidate();
      setShowForm(false);
      setError(null);
      notifySuccess(`"${fd.get('title')}" submitted for approval`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to propose trip');
      notifyError(err, 'Failed to propose trip');
    },
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiFetch(`/trips/${id}/${action}`, { method: 'PATCH' }),
    onSuccess: (_data, { action }) => {
      invalidate();
      notifySuccess(action === 'approve' ? 'Trip approved — guardians notified by SMS' : 'Trip rejected');
      setReviewTarget(null);
    },
    onError: (err) => {
      notifyError(err, 'Failed to update trip');
      setReviewTarget(null);
    },
  });

  const register = useMutation({
    mutationFn: ({ tripId, studentId }: { tripId: string; studentId: string }) =>
      apiFetch(`/trips/${tripId}/register`, { method: 'POST', body: JSON.stringify({ studentId }) }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Registered for the trip');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to register');
      notifyError(err, 'Failed to register');
    },
  });

  const pay = useMutation({
    mutationFn: ({ registrationId, amount }: { registrationId: string; amount: number }) =>
      apiFetch(`/trips/registrations/${registrationId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, method: 'MPESA' }),
      }),
    onSuccess: () => {
      invalidate();
      notifySuccess('Payment received — receipt generated');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Payment failed');
      notifyError(err, 'Payment failed');
    },
  });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      {canPropose && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Trips</CardTitle>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : '+ Propose a trip'}
            </Button>
          </CardHeader>
          <CardContent>
            {showForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  propose.mutate(new FormData(e.currentTarget));
                }}
                className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
              >
                <Input name="title" placeholder="Trip title" required className="col-span-2" />
                <Input name="destination" placeholder="Destination" required />
                <Input name="tripDate" type="date" required />
                <Input name="costPerStudent" type="number" min={1} placeholder="Cost per student (KES)" required />
                <Input name="description" placeholder="Description (optional)" className="col-span-2" />
                {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
                <div className="col-span-2">
                  <Button type="submit" disabled={propose.isPending}>
                    {propose.isPending ? 'Submitting...' : 'Submit for approval'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        {!canPropose && (
          <CardHeader>
            <CardTitle>Trips</CardTitle>
          </CardHeader>
        )}
        <CardContent className={canPropose ? 'pt-6' : undefined}>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-4">
                  <Skeleton className="mb-2 h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : !trips || trips.length === 0 ? (
            <p className="text-sm text-slate-500">No trips yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {trips.map((trip) => {
                const myRegsForTrip = (myRegistrations ?? []).filter((r) => r.tripId === trip.id);
                const registeredStudentIds = new Set(myRegsForTrip.map((r) => r.studentId));
                const availableStudents = (students ?? []).filter((s) => !registeredStudentIds.has(s.id));

                return (
                  <div key={trip.id} className="animate-float-up rounded-lg border border-slate-200 p-4 transition-shadow hover:shadow-sm">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{trip.title}</p>
                        <p className="text-xs text-slate-500">
                          {trip.destination} · {new Date(trip.tripDate).toLocaleDateString()} · KES{' '}
                          {trip.costPerStudent.toLocaleString()}/student
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                        <Badge status={trip.status} />
                        {(trip.status === 'APPROVED' || trip.status === 'PROPOSED') && (
                          <CountdownBadge tripDate={trip.tripDate} />
                        )}
                      </div>
                    </div>
                    {trip.description && <p className="mb-2 text-sm text-slate-600">{trip.description}</p>}
                    <p className="mb-2 text-xs text-slate-400">
                      Proposed by {trip.proposedBy.fullName}
                      {trip.approvedBy && ` · Approved by ${trip.approvedBy.fullName}`}
                      {trip.rejectionReason && ` · Rejected: ${trip.rejectionReason}`}
                    </p>

                    {canManage && trip.status === 'PROPOSED' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setReviewTarget({ id: trip.id, title: trip.title, action: 'approve' })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewTarget({ id: trip.id, title: trip.title, action: 'reject' })}
                        >
                          Reject
                        </Button>
                      </div>
                    )}

                    {canRegister && trip.status === 'APPROVED' && (
                      <div className="mt-2 border-t border-slate-100 pt-3">
                        {myRegsForTrip.map((reg) => (
                          <div key={reg.id} className="mb-2 flex items-center justify-between text-sm">
                            <span>
                              {reg.student.firstName} {reg.student.lastName} —{' '}
                              {reg.status === 'PAID' ? (
                                <span className="text-emerald-700">
                                  Paid (receipt {reg.payments?.[0]?.receiptNumber})
                                </span>
                              ) : (
                                <span className="text-amber-700">Registered, unpaid</span>
                              )}
                            </span>
                            {reg.status === 'UNPAID' && (
                              <Button
                                size="sm"
                                disabled={pay.isPending}
                                onClick={() => pay.mutate({ registrationId: reg.id, amount: trip.costPerStudent })}
                              >
                                Pay KES {trip.costPerStudent.toLocaleString()}
                              </Button>
                            )}
                          </div>
                        ))}
                        {availableStudents.length > 0 && (
                          <div className="flex gap-2">
                            <select
                              className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-xs"
                              value={registerStudentId[trip.id] ?? ''}
                              onChange={(e) =>
                                setRegisterStudentId((d) => ({ ...d, [trip.id]: e.target.value }))
                              }
                            >
                              <option value="">Select child to register</option>
                              {availableStudents.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.firstName} {s.lastName}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!registerStudentId[trip.id] || register.isPending}
                              onClick={() =>
                                register.mutate({ tripId: trip.id, studentId: registerStudentId[trip.id] })
                              }
                            >
                              Register
                            </Button>
                          </div>
                        )}
                        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!reviewTarget}
        title={reviewTarget?.action === 'approve' ? 'Approve this trip?' : 'Reject this trip?'}
        description={
          reviewTarget?.action === 'approve'
            ? `"${reviewTarget?.title}" will become visible to parents, and every guardian will get an SMS notification.`
            : `"${reviewTarget?.title}" will be marked as rejected and the proposing teacher will be notified.`
        }
        tone={reviewTarget?.action === 'approve' ? 'success' : 'danger'}
        confirmLabel={reviewTarget?.action === 'approve' ? 'Approve trip' : 'Reject trip'}
        loading={review.isPending}
        onConfirm={() => reviewTarget && review.mutate({ id: reviewTarget.id, action: reviewTarget.action })}
        onCancel={() => setReviewTarget(null)}
      />
    </div>
  );
}
