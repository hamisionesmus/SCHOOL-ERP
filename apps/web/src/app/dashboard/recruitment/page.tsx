'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonTable } from '@/components/ui/skeleton';

const ROLE_TYPES = ['TRAINER', 'GIG_WORKER', 'SOFTWARE_ENGINEER', 'STAFF'] as const;
type RoleType = (typeof ROLE_TYPES)[number];

interface Position {
  id: string;
  title: string;
  roleType: RoleType;
  roleTypeOther: string | null;
  description: string;
  requiredPositions: number;
  maxApplicants: number;
  closesAt: string | null;
  status: 'OPEN' | 'CLOSED' | 'FILLED';
  createdAt: string;
  _count: { applications: number };
}

interface Application {
  id: string;
  positionId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string | null;
  experienceSummary: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  certificateUrls: string[];
  coverNote: string | null;
  status: 'SUBMITTED' | 'SHORTLISTED' | 'INTERVIEW_SCHEDULED' | 'INTERVIEWED' | 'HIRED' | 'REJECTED';
  interviewAt: string | null;
  interviewNotes: string | null;
  rejectedReason: string | null;
  createdAt: string;
  position: { id: string; title: string; roleType: RoleType };
}

function AddPositionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [roleType, setRoleType] = useState<RoleType>('TRAINER');
  const [roleTypeOther, setRoleTypeOther] = useState('');
  const [description, setDescription] = useState('');
  const [requiredPositions, setRequiredPositions] = useState('1');
  const [maxApplicants, setMaxApplicants] = useState('20');
  const [closesAt, setClosesAt] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/recruitment/positions', {
        method: 'POST',
        body: JSON.stringify({
          title,
          roleType,
          roleTypeOther: roleType === 'STAFF' ? roleTypeOther : undefined,
          description,
          requiredPositions: Number(requiredPositions),
          maxApplicants: Number(maxApplicants),
          closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Position created');
      setOpen(false);
      setTitle('');
      setDescription('');
      setRoleTypeOther('');
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to create position'),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> New Position
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">New Vacancy Position</h3>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Position title" />
          <select value={roleType} onChange={(e) => setRoleType(e.target.value as RoleType)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {ROLE_TYPES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {roleType === 'STAFF' && (
            <Input value={roleTypeOther} onChange={(e) => setRoleTypeOther(e.target.value)} placeholder="Specify the role" />
          )}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this role, and what will they do?"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Positions needed</label>
              <Input type="number" min={1} value={requiredPositions} onChange={(e) => setRequiredPositions(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Max applicants</label>
              <Input type="number" min={1} value={maxApplicants} onChange={(e) => setMaxApplicants(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Closes on (optional)</label>
            <Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!title.trim() || !description.trim() || (roleType === 'STAFF' && !roleTypeOther.trim()) || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApplicationDetail({ app, onClose, onChanged }: { app: Application; onClose: () => void; onChanged: () => void }) {
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskRepoUrl, setTaskRepoUrl] = useState('');
  const [mode, setMode] = useState<'view' | 'interview' | 'reject' | 'hire'>('view');

  const schedule = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/recruitment/applications/${app.id}/schedule-interview`, {
        method: 'PATCH',
        body: JSON.stringify({ interviewAt: new Date(interviewAt).toISOString(), notes: interviewNotes || undefined }),
      }),
    onSuccess: () => {
      notifySuccess('Interview scheduled');
      onChanged();
      onClose();
    },
    onError: (err) => notifyError(err, 'Failed to schedule interview'),
  });

  const reject = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/recruitment/applications/${app.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectReason || undefined }),
      }),
    onSuccess: () => {
      notifySuccess('Application rejected');
      onChanged();
      onClose();
    },
    onError: (err) => notifyError(err, 'Failed to reject application'),
  });

  const hire = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/recruitment/applications/${app.id}/hire`, {
        method: 'POST',
        body: JSON.stringify({
          taskTitle: taskTitle || undefined,
          taskDescription: taskDescription || undefined,
          taskRepoUrl: taskRepoUrl || undefined,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Hired! Login details sent.');
      onChanged();
      onClose();
    },
    onError: (err) => notifyError(err, 'Failed to hire applicant'),
  });

  const final = app.status === 'HIRED' || app.status === 'REJECTED';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{app.fullName}</h3>
            <p className="text-sm text-slate-500">{app.position.title}</p>
          </div>
          <Badge status={app.status} />
        </div>

        <div className="space-y-1.5 text-sm text-slate-600">
          <p>{app.email} · {app.phone}</p>
          {app.address && <p>{app.address}</p>}
          {app.experienceSummary && <p className="mt-2 whitespace-pre-wrap text-slate-700">{app.experienceSummary}</p>}
          <div className="mt-2 flex flex-wrap gap-3">
            {app.linkedinUrl && (
              <a href={app.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                LinkedIn <ExternalLink size={11} />
              </a>
            )}
            {app.githubUrl && (
              <a href={app.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                GitHub <ExternalLink size={11} />
              </a>
            )}
            {app.certificateUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                Certificate {i + 1} <ExternalLink size={11} />
              </a>
            ))}
          </div>
          {app.coverNote && <p className="mt-2 italic text-slate-500">&quot;{app.coverNote}&quot;</p>}
          {app.interviewAt && <p className="mt-2 text-xs text-slate-500">Interview: {new Date(app.interviewAt).toLocaleString()}</p>}
          {app.rejectedReason && <p className="mt-2 text-xs text-rose-500">Rejected: {app.rejectedReason}</p>}
        </div>

        {!final && mode === 'view' && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode('interview')}>
              Schedule Interview
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('hire')}>
              Hire
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setMode('reject')}>
              Reject
            </Button>
          </div>
        )}

        {mode === 'interview' && (
          <div className="mt-5 space-y-2 rounded-lg border border-slate-200 p-3">
            <Input type="datetime-local" value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} />
            <textarea
              value={interviewNotes}
              onChange={(e) => setInterviewNotes(e.target.value)}
              placeholder="Interview notes / link (optional)"
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!interviewAt || schedule.isPending} onClick={() => schedule.mutate()}>
                {schedule.isPending ? 'Saving...' : 'Confirm'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === 'reject' && (
          <div className="mt-5 space-y-2 rounded-lg border border-slate-200 p-3">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional, internal)"
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate()}>
                {reject.isPending ? 'Rejecting...' : 'Confirm reject'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === 'hire' && (
          <div className="mt-5 space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Creates their login and sends congratulations with credentials. Optionally assign a first task.</p>
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="First task title (optional)" />
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Task description (optional)"
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <Input value={taskRepoUrl} onChange={(e) => setTaskRepoUrl(e.target.value)} placeholder="Repo URL (optional)" />
            <div className="flex gap-2">
              <Button size="sm" disabled={hire.isPending} onClick={() => hire.mutate()}>
                {hire.isPending ? 'Hiring...' : 'Confirm hire'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RecruitmentPage() {
  const queryClient = useQueryClient();
  const { data: positions, isLoading: loadingPositions } = useQuery({
    queryKey: ['recruitment-positions'],
    queryFn: () => apiFetch<Position[]>('/platform/recruitment/positions'),
  });
  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ['recruitment-applications'],
    queryFn: () => apiFetch<Application[]>('/platform/recruitment/applications'),
  });
  const [selected, setSelected] = useState<Application | null>(null);

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ['recruitment-positions'] });
    queryClient.invalidateQueries({ queryKey: ['recruitment-applications'] });
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Recruitment</h1>
          <p className="text-sm text-slate-500">Open positions, applicants, interviews, and hires.</p>
        </div>
        <AddPositionDialog onCreated={refetchAll} />
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPositions ? (
            <SkeletonTable rows={3} cols={6} />
          ) : !positions || positions.length === 0 ? (
            <p className="text-sm text-slate-500">No positions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Title</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 font-medium">Needed / Cap</th>
                  <th className="py-2 font-medium">Applicants</th>
                  <th className="py-2 font-medium">Closes</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{p.title}</td>
                    <td className="py-2 text-slate-500">{p.roleType === 'STAFF' ? p.roleTypeOther ?? 'Staff' : p.roleType.replace(/_/g, ' ')}</td>
                    <td className="py-2 text-slate-500">
                      {p.requiredPositions} / {p.maxApplicants}
                    </td>
                    <td className="py-2 text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} /> {p._count.applications}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">{p.closesAt ? new Date(p.closesAt).toLocaleDateString() : '—'}</td>
                    <td className="py-2">
                      <Badge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingApps ? (
            <SkeletonTable rows={3} cols={5} />
          ) : !applications || applications.length === 0 ? (
            <p className="text-sm text-slate-500">No applications yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 font-medium">Applicant</th>
                  <th className="py-2 font-medium">Position</th>
                  <th className="py-2 font-medium">Applied</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setSelected(a)}>
                    <td className="py-2 font-medium text-slate-900">{a.fullName}</td>
                    <td className="py-2 text-slate-500">{a.position.title}</td>
                    <td className="py-2 text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="py-2">
                      <Badge status={a.status} />
                    </td>
                    <td className="py-2 text-right text-xs text-blue-600">View</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {selected && <ApplicationDetail app={selected} onClose={() => setSelected(null)} onChanged={refetchAll} />}
    </>
  );
}
