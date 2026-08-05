'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, ListChecks, Plus, Trash2, Users, Video } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ROLE_TAGS = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'] as const;
const TEAM_TAGS = ['DEVELOPER', 'FRONTEND', 'BACKEND', 'LEADS', 'MARKETING'] as const;

interface ExternalContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}
interface ExternalRow {
  name: string;
  email: string;
  phone: string;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  agenda: string[];
  meetingLink: string | null;
  scheduledAt: string;
  audienceRoles: string[];
  audienceTeamTags: string[];
  createdByUserId: string;
  createdBy: { fullName: string };
  minutes: string | null;
  minutesUpdatedAt: string | null;
  _count: { attendance: number };
}

interface AttendancePerson {
  email: string | null;
  name: string | null;
  joinedAt?: string;
}
interface AttendanceSummary {
  totalInvited: number;
  totalPresent: number;
  totalAbsent: number;
  present: AttendancePerson[];
  absent: AttendancePerson[];
  extraJoins: AttendancePerson[];
  minutes: string | null;
  minutesUpdatedAt: string | null;
}

function AttendancePanel({ meetingId }: { meetingId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['meeting-attendance', meetingId],
    queryFn: () => apiFetch<AttendanceSummary>(`/platform/meetings/${meetingId}/attendance`),
  });

  if (isLoading) return <p className="mt-2 text-xs text-slate-400">Loading attendance...</p>;
  if (!data) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-slate-700">
          {data.totalPresent}/{data.totalInvited} present
        </span>
        {data.totalAbsent > 0 && <span className="text-slate-500">{data.totalAbsent} absent</span>}
        {data.extraJoins.length > 0 && <span className="text-slate-400">+{data.extraJoins.length} joined without a matching invite</span>}
      </div>
      {data.present.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">Present</p>
          <ul className="mt-1 space-y-0.5">
            {data.present.map((p) => (
              <li key={p.email} className="text-xs text-slate-700">
                {p.name ?? p.email} <span className="text-slate-400">— {p.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.absent.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Absent</p>
          <ul className="mt-1 space-y-0.5">
            {data.absent.map((p) => (
              <li key={p.email} className="text-xs text-slate-500">
                {p.name ?? p.email} <span className="text-slate-400">— {p.email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.totalInvited === 0 && <p className="mt-1 text-xs text-slate-400">No email-reachable invitees to track attendance for.</p>}
    </div>
  );
}

function MinutesSection({ meeting, canEdit, queryClient }: { meeting: Meeting; canEdit: boolean; queryClient: ReturnType<typeof useQueryClient> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meeting.minutes ?? '');

  const save = useMutation({
    mutationFn: () => apiFetch(`/platform/meetings/${meeting.id}/minutes`, { method: 'PATCH', body: JSON.stringify({ minutes: draft }) }),
    onSuccess: () => {
      notifySuccess('Minutes saved');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['meetings-mine'] });
      queryClient.invalidateQueries({ queryKey: ['meetings-all'] });
    },
    onError: (err) => notifyError(err, 'Failed to save minutes'),
  });

  if (!editing) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Minutes</p>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
              {meeting.minutes ? 'Edit' : 'Add minutes'}
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{meeting.minutes || 'No minutes recorded yet.'}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 p-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Minutes</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="What was discussed and decided..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(meeting.minutes ?? ''); }}>
          Cancel
        </Button>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving...' : 'Save minutes'}
        </Button>
      </div>
    </div>
  );
}

function MeetingCard({ m, isAdmin, currentUserId, queryClient }: { m: Meeting; isAdmin: boolean; currentUserId?: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [showAttendance, setShowAttendance] = useState(false);
  const upcoming = new Date(m.scheduledAt).getTime() > Date.now();
  const canManage = isAdmin || m.createdByUserId === currentUserId;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{m.title}</p>
          <p className="text-xs text-slate-400">
            {new Date(m.scheduledAt).toLocaleString()} · by {m.createdBy.fullName}
          </p>
          {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
          {m.agenda.length > 0 && (
            <div className="mt-1.5">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <ListChecks size={12} /> Agenda
              </p>
              <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-xs text-slate-600">
                {m.agenda.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </div>
          )}
          <p className="mt-1.5 text-xs text-slate-400">
            {[...m.audienceRoles, ...m.audienceTeamTags].join(', ') || 'Specific invitees'}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          {m.meetingLink && upcoming && (
            <a href={m.meetingLink} target="_blank" rel="noreferrer">
              <Button size="sm" className="gap-1.5">
                <Video size={13} /> Join
              </Button>
            </a>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowAttendance((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <Users size={12} /> {m._count.attendance} joined
              {showAttendance ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          {!canManage && m._count.attendance > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <CheckCircle2 size={12} /> {m._count.attendance} joined
            </span>
          )}
        </div>
      </div>

      {canManage && showAttendance && <AttendancePanel meetingId={m.id} />}
      {(canManage || m.minutes) && <MinutesSection meeting={m} canEdit={canManage} queryClient={queryClient} />}
    </div>
  );
}

function CreateMeetingDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [audienceRoles, setAudienceRoles] = useState<string[]>([]);
  const [audienceTeamTags, setAudienceTeamTags] = useState<string[]>([]);
  const [pickedContactIds, setPickedContactIds] = useState<string[]>([]);
  const [newExternalRows, setNewExternalRows] = useState<ExternalRow[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [agenda, setAgenda] = useState<string[]>([]);

  const { data: savedContacts } = useQuery({
    queryKey: ['external-contacts', contactSearch],
    queryFn: () => apiFetch<ExternalContact[]>(`/platform/external-contacts${contactSearch ? `?q=${encodeURIComponent(contactSearch)}` : ''}`),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      const newIds: string[] = [];
      for (const row of newExternalRows.filter((r) => r.name.trim() && (r.email.trim() || r.phone.trim()))) {
        const contact = await apiFetch<ExternalContact>('/platform/external-contacts', {
          method: 'POST',
          body: JSON.stringify({ name: row.name.trim(), email: row.email.trim() || undefined, phone: row.phone.trim() || undefined }),
        });
        newIds.push(contact.id);
      }
      return apiFetch('/platform/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          meetingLink: meetingLink || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          audienceRoles,
          audienceTeamTags,
          externalContactIds: [...pickedContactIds, ...newIds],
          agenda: agenda.map((a) => a.trim()).filter(Boolean),
        }),
      });
    },
    onSuccess: () => {
      notifySuccess('Meeting scheduled — invites sent by email/SMS');
      setOpen(false);
      setTitle('');
      setDescription('');
      setMeetingLink('');
      setScheduledAt('');
      setAudienceRoles([]);
      setAudienceTeamTags([]);
      setPickedContactIds([]);
      setNewExternalRows([]);
      setAgenda([]);
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to schedule meeting'),
  });

  function toggle(arr: string[], setArr: (v: string[]) => void, v: string) {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  function updateExternalRow(i: number, field: keyof ExternalRow, value: string) {
    setNewExternalRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function updateAgendaItem(i: number, value: string) {
    setAgenda((rows) => rows.map((r, idx) => (idx === i ? value : r)));
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={15} /> Schedule Meeting
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Schedule Meeting</h3>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
          <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="Zoom / Google Meet link" />
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">Agenda</p>
              <button
                type="button"
                onClick={() => setAgenda((rows) => [...rows, ''])}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus size={12} /> Add item
              </button>
            </div>
            {agenda.length === 0 ? (
              <p className="text-xs text-slate-400">No agenda items yet — invitees see whatever&apos;s listed here.</p>
            ) : (
              <div className="space-y-1.5">
                {agenda.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-4 flex-shrink-0 text-xs text-slate-400">{i + 1}.</span>
                    <Input value={item} onChange={(e) => updateAgendaItem(i, e.target.value)} placeholder={`Agenda item ${i + 1}`} className="h-8 text-xs" />
                    <button
                      type="button"
                      onClick={() => setAgenda((rows) => rows.filter((_, idx) => idx !== i))}
                      className="flex-shrink-0 text-slate-400 hover:text-rose-600"
                      aria-label="Remove agenda item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Audience — roles</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_TAGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(audienceRoles, setAudienceRoles, r)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    audienceRoles.includes(r) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {r.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Audience — team tags</p>
            <div className="flex flex-wrap gap-1.5">
              {TEAM_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(audienceTeamTags, setAudienceTeamTags, t)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    audienceTeamTags.includes(t) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Audience — other people (not in the system)</p>
            <div className="rounded-lg border border-slate-200 p-2">
              <Input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search saved external contacts..."
                className="h-8 text-xs"
              />
              <div className="mt-1.5 max-h-28 overflow-y-auto">
                {!savedContacts || savedContacts.length === 0 ? (
                  <p className="px-1 py-2 text-center text-xs text-slate-400">No saved external contacts yet — add one below.</p>
                ) : (
                  savedContacts.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={pickedContactIds.includes(c.id)}
                        onChange={() => toggle(pickedContactIds, setPickedContactIds, c.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <span className="text-slate-400">{c.email ?? c.phone}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-400">External contact — not a system account</p>
              <button
                type="button"
                onClick={() => setNewExternalRows((rows) => [...rows, { name: '', email: '', phone: '' }])}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus size={12} /> Add new
              </button>
            </div>
            {newExternalRows.length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                {newExternalRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input value={row.name} onChange={(e) => updateExternalRow(i, 'name', e.target.value)} placeholder="Name" className="h-8 text-xs" />
                    <Input value={row.email} onChange={(e) => updateExternalRow(i, 'email', e.target.value)} placeholder="Email" className="h-8 text-xs" />
                    <Input value={row.phone} onChange={(e) => updateExternalRow(i, 'phone', e.target.value)} placeholder="Phone" className="h-8 text-xs" />
                    <button
                      type="button"
                      onClick={() => setNewExternalRows((rows) => rows.filter((_, idx) => idx !== i))}
                      className="flex-shrink-0 text-slate-400 hover:text-rose-600"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Invitees with an email get a personalized join link — opening it marks them present automatically. They&apos;re advised to open
            it using the same email they were invited with.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!title.trim() || !scheduledAt || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Scheduling...' : 'Schedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const queryClient = useQueryClient();
  const sessionUser = getSessionUser();
  const role = sessionUser?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'SUB_ADMIN' || role === 'ASSISTANT_SUPER_ADMIN';

  const { data: mine, isLoading } = useQuery({ queryKey: ['meetings-mine'], queryFn: () => apiFetch<Meeting[]>('/platform/meetings/mine') });
  const { data: all } = useQuery({ queryKey: ['meetings-all'], queryFn: () => apiFetch<Meeting[]>('/platform/meetings'), enabled: isAdmin });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meetings</h1>
          <p className="text-sm text-slate-500">Zoom/Meet links shared in-app and by SMS — attendance is tracked automatically.</p>
        </div>
        {isAdmin && <CreateMeetingDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ['meetings-mine', 'meetings-all'] })} />}
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">My Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : !mine || mine.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarClock size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">No meetings scheduled for you yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mine.map((m) => (
                <MeetingCard key={m.id} m={m} isAdmin={isAdmin} currentUserId={sessionUser?.sub} queryClient={queryClient} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            {!all || all.length === 0 ? (
              <p className="text-sm text-slate-500">No meetings scheduled yet.</p>
            ) : (
              <div className="space-y-2">
                {all.map((m) => (
                  <MeetingCard key={m.id} m={m} isAdmin={isAdmin} currentUserId={sessionUser?.sub} queryClient={queryClient} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
