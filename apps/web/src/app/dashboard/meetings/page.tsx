'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Video } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ROLE_TAGS = ['SUPER_ADMIN', 'SUB_ADMIN', 'ASSISTANT_SUPER_ADMIN', 'TRAINER'] as const;
const TEAM_TAGS = ['DEVELOPER', 'FRONTEND', 'BACKEND', 'LEADS', 'MARKETING'] as const;

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meetingLink: string | null;
  scheduledAt: string;
  audienceRoles: string[];
  audienceTeamTags: string[];
  createdBy: { fullName: string };
}

function MeetingCard({ m }: { m: Meeting }) {
  const upcoming = new Date(m.scheduledAt).getTime() > Date.now();
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{m.title}</p>
          <p className="text-xs text-slate-400">
            {new Date(m.scheduledAt).toLocaleString()} · by {m.createdBy.fullName}
          </p>
          {m.description && <p className="mt-1 text-sm text-slate-600">{m.description}</p>}
          <p className="mt-1 text-xs text-slate-400">
            {[...m.audienceRoles, ...m.audienceTeamTags].join(', ') || 'Specific invitees'}
          </p>
        </div>
        {m.meetingLink && upcoming && (
          <a href={m.meetingLink} target="_blank" rel="noreferrer">
            <Button size="sm" className="gap-1.5">
              <Video size={13} /> Join
            </Button>
          </a>
        )}
      </div>
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

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/platform/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          meetingLink: meetingLink || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
          audienceRoles,
          audienceTeamTags,
        }),
      }),
    onSuccess: () => {
      notifySuccess('Meeting scheduled — invites sent by email/SMS');
      setOpen(false);
      setTitle('');
      setDescription('');
      setMeetingLink('');
      setScheduledAt('');
      setAudienceRoles([]);
      setAudienceTeamTags([]);
      onCreated();
    },
    onError: (err) => notifyError(err, 'Failed to schedule meeting'),
  });

  function toggle(arr: string[], setArr: (v: string[]) => void, v: string) {
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
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
  const role = getSessionUser()?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'SUB_ADMIN' || role === 'ASSISTANT_SUPER_ADMIN';

  const { data: mine, isLoading } = useQuery({ queryKey: ['meetings-mine'], queryFn: () => apiFetch<Meeting[]>('/platform/meetings/mine') });
  const { data: all } = useQuery({ queryKey: ['meetings-all'], queryFn: () => apiFetch<Meeting[]>('/platform/meetings'), enabled: isAdmin });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meetings</h1>
          <p className="text-sm text-slate-500">Zoom/Meet links shared in-app and by SMS.</p>
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
                <MeetingCard key={m.id} m={m} />
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
                  <MeetingCard key={m.id} m={m} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
