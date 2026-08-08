'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError, API_ORIGIN } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { SortableTh } from '@/components/ui/sortable-th';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useTableControls } from '@/hooks/use-table-controls';
import { cn } from '@/lib/utils';
import { useDraftState } from '@/hooks/use-draft-state';

interface UserRef {
  id: string;
  fullName: string;
  email: string;
}
interface WorkflowStep {
  order: number;
  name: string;
  approverPermissionCode: string;
}
interface WorkflowStepAction {
  stepOrder: number;
  action: 'APPROVE' | 'REJECT';
  comment: string | null;
  actedAt: string;
  actor: { id: string; fullName: string };
}
interface WorkflowInstance {
  status: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
  currentStepOrder: number;
  workflow: { steps: WorkflowStep[] };
  actions: WorkflowStepAction[];
}
interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: UserRef;
  workflowInstance: WorkflowInstance | null;
}
interface Payslip {
  id: string;
  staff: UserRef;
  periodMonth: number;
  periodYear: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  notes: string | null;
}
interface WorkLog {
  id: string;
  staff: UserRef;
  date: string;
  tasksDone: string;
  tasksPending: string | null;
}
interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  userRoles: { role: { name: string } }[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function kes(n: number) {
  return `KES ${n.toLocaleString()}`;
}

const TABS = ['Leave', 'Payslips', 'Work Log'] as const;
type Tab = (typeof TABS)[number];

export default function HrPage() {
  const { user } = useSession('tenant');
  const [tab, setTab] = useState<Tab>('Leave');
  const canReview = !!user?.permissions?.includes('HR:EDIT');

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Leave' && <LeaveTab canReview={canReview} permissions={user.permissions ?? []} />}
      {tab === 'Payslips' && <PayslipsTab canReview={canReview} />}
      {tab === 'Work Log' && <WorkLogTab canReview={canReview} />}
    </div>
  );
}

type LeaveDraft = { leaveType: string; startDate: string; endDate: string; reason: string };

/** Which permission code (if any) is required to act on this request right now. `null` when the
 * request has closed or was never gated by a workflow step (the fallback HR:EDIT path is checked
 * by the caller via `canReview` instead). */
function currentStepFor(r: LeaveRequest) {
  if (!r.workflowInstance || r.workflowInstance.status !== 'IN_PROGRESS') return null;
  return r.workflowInstance.workflow.steps.find((s) => s.order === r.workflowInstance!.currentStepOrder) ?? null;
}

function LeaveRequestItem({
  r,
  canReview,
  permissions,
  onReview,
  reviewPending,
}: {
  r: LeaveRequest;
  canReview: boolean;
  permissions: string[];
  onReview: (id: string, action: 'approve' | 'reject', comment?: string) => void;
  reviewPending: boolean;
}) {
  const [comment, setComment] = useState('');
  const currentStep = currentStepFor(r);
  const canActNow = r.workflowInstance
    ? !!currentStep && permissions.includes(currentStep.approverPermissionCode)
    : canReview && r.status === 'PENDING';

  return (
    <li className="rounded-lg border border-slate-200 p-3">
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
          {r.workflowInstance && (
            <p className="mt-1 text-xs text-slate-500">
              {r.workflowInstance.status === 'IN_PROGRESS' && currentStep
                ? `Step ${currentStep.order + 1} of ${r.workflowInstance.workflow.steps.length} — ${currentStep.name}`
                : `Approval chain ${r.workflowInstance.status.toLowerCase()}`}
            </p>
          )}
        </div>
        <Badge status={r.status} />
      </div>

      {r.workflowInstance && r.workflowInstance.actions.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {r.workflowInstance.actions.map((a, i) => (
            <li key={i}>
              {a.actor.fullName} {a.action === 'APPROVE' ? 'approved' : 'rejected'} on {new Date(a.actedAt).toLocaleDateString()}
              {a.comment && ` — "${a.comment}"`}
            </li>
          ))}
        </ul>
      )}

      {canActNow && (
        <div className="mt-2 flex flex-col gap-2">
          {r.workflowInstance && (
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className="h-9 text-sm" />
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={reviewPending} onClick={() => onReview(r.id, 'approve', comment || undefined)}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={reviewPending} onClick={() => onReview(r.id, 'reject', comment || undefined)}>
              Reject
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function LeaveTab({ canReview, permissions }: { canReview: boolean; permissions: string[] }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadDraft, saveDraft, clearDraft } = useDraftState<LeaveDraft>('hr-leave');
  const draft = loadDraft();
  const [leaveType, setLeaveType] = useState(draft?.leaveType ?? '');
  const [startDate, setStartDate] = useState(draft?.startDate ?? '');
  const [endDate, setEndDate] = useState(draft?.endDate ?? '');
  const [reason, setReason] = useState(draft?.reason ?? '');

  useEffect(() => {
    saveDraft({ leaveType, startDate, endDate, reason });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveType, startDate, endDate, reason]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => apiFetch<LeaveRequest[]>('/hr/leave-requests'),
  });

  const createRequest = useMutation({
    mutationFn: () =>
      apiFetch('/hr/leave-requests', {
        method: 'POST',
        body: JSON.stringify({ leaveType, startDate, endDate, reason: reason || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setShowForm(false);
      setError(null);
      setLeaveType('');
      setStartDate('');
      setEndDate('');
      setReason('');
      clearDraft();
      notifySuccess('Leave request submitted');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to submit request');
      notifyError(err, 'Failed to submit request');
    },
  });

  const review = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: 'approve' | 'reject'; comment?: string }) =>
      apiFetch(`/hr/leave-requests/${id}/${action}`, { method: 'PATCH', body: JSON.stringify({ comment }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      notifySuccess('Leave request updated');
    },
    onError: (err) => notifyError(err, 'Failed to update request'),
  });

  const table = useTableControls(requests ?? [], { pageSize: 8 });

  return (
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
              createRequest.mutate();
            }}
            className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4"
          >
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              required
              className="col-span-2 h-10 rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">Leave type</option>
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Maternity">Maternity</option>
              <option value="Paternity">Paternity</option>
              <option value="Compassionate">Compassionate</option>
            </select>
            <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" required />
            <Input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" required />
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="col-span-2" />
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
          <>
          <ul className="flex flex-col gap-3">
            {table.pageItems.map((r) => (
              <LeaveRequestItem
                key={r.id}
                r={r}
                canReview={canReview}
                permissions={permissions}
                reviewPending={review.isPending}
                onReview={(id, action, comment) => review.mutate({ id, action, comment })}
              />
            ))}
          </ul>
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

function PayslipsTab({ canReview }: { canReview: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payslips'],
    queryFn: () => apiFetch<Payslip[]>('/hr/payslips'),
  });
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<StaffUser[]>('/users'),
    enabled: canReview,
  });

  const issuePayslip = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/hr/payslips', {
        method: 'POST',
        body: JSON.stringify({
          staffUserId: fd.get('staffUserId'),
          periodMonth: Number(fd.get('periodMonth')),
          periodYear: Number(fd.get('periodYear')),
          grossPay: Number(fd.get('grossPay')),
          deductions: fd.get('deductions') ? Number(fd.get('deductions')) : undefined,
          notes: fd.get('notes') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] });
      setShowForm(false);
      setError(null);
      setStaffUserId('');
      notifySuccess('Payslip issued');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to issue payslip');
      notifyError(err, 'Failed to issue payslip');
    },
  });

  const [staffUserId, setStaffUserId] = useState('');

  async function downloadPayslip(id: string) {
    setDownloadingId(id);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_ORIGIN}/hr/payslips/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to generate payslip PDF');
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameMatch?.[1] ?? 'payslip.pdf';
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess('Payslip downloaded');
    } catch (err) {
      notifyError(err, 'Failed to download payslip');
    } finally {
      setDownloadingId(null);
    }
  }

  const table = useTableControls(payslips ?? [], { pageSize: 8 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{canReview ? 'Payslips' : 'My payslips'}</CardTitle>
        {canReview && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Issue payslip'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {showForm && canReview && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              issuePayslip.mutate(new FormData(e.currentTarget));
            }}
            className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 animate-float-up"
          >
            <SearchableSelect
              name="staffUserId"
              value={staffUserId}
              onChange={setStaffUserId}
              required
              placeholder="Select staff member"
              className="col-span-2"
              options={(users ?? []).map((u) => ({ value: u.id, label: u.fullName, sublabel: u.email }))}
            />
            <select name="periodMonth" required className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="">Month</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <Input name="periodYear" type="number" placeholder="Year" defaultValue={new Date().getFullYear()} required />
            <Input name="grossPay" type="number" min={0} placeholder="Gross pay (KES)" required />
            <Input name="deductions" type="number" min={0} placeholder="Deductions (KES, optional)" />
            <Input name="notes" placeholder="Notes (optional)" className="col-span-2" />
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={issuePayslip.isPending}>
                {issuePayslip.isPending ? 'Saving...' : 'Issue payslip'}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : !payslips || payslips.length === 0 ? (
          <p className="text-sm text-slate-500">No payslips yet.</p>
        ) : (
          <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                {canReview && <th className="py-2 font-medium">Staff</th>}
                <th className="py-2 font-medium">Period</th>
                <SortableTh label="Gross" active={table.sortKey === 'grossPay'} dir={table.sortDir} onClick={() => table.toggleSort('grossPay')} />
                <th className="py-2 font-medium">Deductions</th>
                <SortableTh label="Net" active={table.sortKey === 'netPay'} dir={table.sortDir} onClick={() => table.toggleSort('netPay')} />
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {table.pageItems.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  {canReview && <td className="py-2 text-slate-700">{p.staff.fullName}</td>}
                  <td className="py-2 text-slate-500">
                    {MONTH_NAMES[p.periodMonth - 1]} {p.periodYear}
                  </td>
                  <td className="py-2 text-slate-500">{kes(p.grossPay)}</td>
                  <td className="py-2 text-slate-500">{kes(p.deductions)}</td>
                  <td className="py-2 font-medium text-emerald-700">{kes(p.netPay)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === p.id}
                      onClick={() => downloadPayslip(p.id)}
                    >
                      {downloadingId === p.id ? '...' : 'Download PDF'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

function WorkLogTab({ canReview }: { canReview: boolean }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['work-logs'],
    queryFn: () => apiFetch<WorkLog[]>('/hr/work-logs'),
  });

  const submitLog = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/hr/work-logs', {
        method: 'POST',
        body: JSON.stringify({
          date: fd.get('date'),
          tasksDone: fd.get('tasksDone'),
          tasksPending: fd.get('tasksPending') || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
      setError(null);
      notifySuccess('Work log saved');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to save work log');
      notifyError(err, 'Failed to save work log');
    },
  });

  const table = useTableControls(logs ?? [], { pageSize: 8 });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Log today&apos;s work</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLog.mutate(new FormData(e.currentTarget));
            }}
            className="grid grid-cols-2 gap-3"
          >
            <Input name="date" type="date" defaultValue={today} required />
            <div />
            <textarea
              name="tasksDone"
              placeholder="What did you do today?"
              required
              rows={2}
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              name="tasksPending"
              placeholder="Anything pending / carried over? (optional)"
              rows={2}
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={submitLog.isPending}>
                {submitLog.isPending ? 'Saving...' : 'Save log'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{canReview ? 'All work logs' : 'My work logs'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !logs || logs.length === 0 ? (
            <p className="text-sm text-slate-500">No work logs yet.</p>
          ) : (
            <>
            <ul className="flex flex-col gap-3">
              {table.pageItems.map((l) => (
                <li key={l.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-medium uppercase text-slate-400">
                    {new Date(l.date).toLocaleDateString()}
                    {canReview && ` — ${l.staff.fullName}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{l.tasksDone}</p>
                  {l.tasksPending && <p className="mt-1 text-sm text-amber-700">Pending: {l.tasksPending}</p>}
                </li>
              ))}
            </ul>
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
    </div>
  );
}
