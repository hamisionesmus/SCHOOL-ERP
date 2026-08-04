'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { useDraftState } from '@/hooks/use-draft-state';

interface SchoolClass {
  id: string;
  name: string;
}
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  currentClassId: string | null;
}
interface GuardianUser {
  id: string;
  fullName: string;
  email: string;
}
interface StudentDetail extends Student {
  guardians: { guardianUser: GuardianUser }[];
}
interface SmsMessage {
  id: string;
  recipientPhone: string;
  body: string;
  status: 'SENT' | 'FAILED';
  createdAt: string;
}

export default function AnnouncementsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const { loadDraft, saveDraft, clearDraft } = useDraftState<{ classId: string; body: string }>('announcements-message');
  const draft = loadDraft();
  const [classId, setClassId] = useState(draft?.classId ?? '');
  const [guardians, setGuardians] = useState<GuardianUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [body, setBody] = useState(draft?.body ?? '');
  const [loadingGuardians, setLoadingGuardians] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoredGuardiansOnce = useRef(false);

  useEffect(() => {
    saveDraft({ classId, body });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, body]);

  const canSend = user?.permissions?.includes('ANNOUNCEMENT:SEND_TO_PARENTS');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => apiFetch<SchoolClass[]>('/classes'),
    enabled: !!user && !!canSend,
  });
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
    enabled: !!user && !!canSend,
  });
  const { data: messages } = useQuery({
    queryKey: ['messages'],
    queryFn: () => apiFetch<SmsMessage[]>('/communications/messages'),
    enabled: !!user,
  });

  async function loadGuardians(selectedClassId: string) {
    setClassId(selectedClassId);
    setGuardians([]);
    setSelectedIds(new Set());
    if (!selectedClassId || !students) return;
    setLoadingGuardians(true);
    try {
      const classStudents = students.filter((s) => s.currentClassId === selectedClassId);
      const details = await Promise.all(
        classStudents.map((s) => apiFetch<StudentDetail>(`/students/${s.id}`)),
      );
      const unique = new Map<string, GuardianUser>();
      for (const d of details) {
        for (const g of d.guardians) unique.set(g.guardianUser.id, g.guardianUser);
      }
      const list = Array.from(unique.values());
      setGuardians(list);
      setSelectedIds(new Set(list.map((g) => g.id)));
    } finally {
      setLoadingGuardians(false);
    }
  }

  // Re-derive the guardian list for a restored draft's classId once students load — the draft only
  // stores classId/body, not the fetched guardian list itself.
  useEffect(() => {
    if (restoredGuardiansOnce.current || !classId || !students) return;
    restoredGuardiansOnce.current = true;
    loadGuardians(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const sendAnnouncement = useMutation({
    mutationFn: () =>
      apiFetch('/communications/announcements', {
        method: 'POST',
        body: JSON.stringify({ recipientUserIds: Array.from(selectedIds), body }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setBody('');
      setError(null);
      clearDraft();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to send announcement'),
  });

  const table = useTableControls(messages ?? [], { pageSize: 10 });

  if (!user) return null;

  return (
    <>
          {canSend && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Send announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              value={classId}
              onChange={(e) => loadGuardians(e.target.value)}
              className="mb-3 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">Select a class</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {loadingGuardians ? (
              <p className="text-sm text-slate-500">Loading guardians...</p>
            ) : classId && guardians.length === 0 ? (
              <p className="text-sm text-slate-500">No guardians linked to students in this class yet.</p>
            ) : (
              guardians.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {guardians.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(g.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(g.id);
                            else next.delete(g.id);
                            return next;
                          })
                        }
                      />
                      {g.fullName}
                    </label>
                  ))}
                </div>
              )
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message to send..."
              rows={3}
              maxLength={480}
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <Button
              disabled={selectedIds.size === 0 || !body || sendAnnouncement.isPending}
              onClick={() => sendAnnouncement.mutate()}
            >
              {sendAnnouncement.isPending ? 'Sending...' : `Send to ${selectedIds.size} guardian(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{canSend ? 'Recent messages' : 'Your messages'}</CardTitle>
        </CardHeader>
        <CardContent>
          {!messages || messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet.</p>
          ) : (
            <>
            <ul className="flex flex-col gap-2">
              {table.pageItems.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="text-slate-900">{m.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {m.recipientPhone} · {m.status} · {new Date(m.createdAt).toLocaleString()}
                  </p>
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
    </>
  );
}
