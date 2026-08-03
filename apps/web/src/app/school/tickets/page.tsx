'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, X } from 'lucide-react';
import { useSession } from '@/lib/use-session';
import { apiFetch, ApiError } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useTableControls } from '@/hooks/use-table-controls';
import { useTicketSocket } from '@/lib/ticket-socket';

const CATEGORIES = ['TECHNICAL', 'BILLING', 'ACCOUNT', 'GENERAL', 'COMPLAINT', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

interface UserRef {
  id: string;
  fullName: string;
  email: string;
}
interface Comment {
  id: string;
  body: string;
  createdAt: string;
  isPlatformReply: boolean;
  platformAuthorName: string | null;
  // Live socket-delivered comments only carry {id, fullName} (see TicketsGateway payload) — narrower
  // than the full UserRef the REST-fetched submittedBy/handledBy fields use, but comments only ever
  // render .fullName, so this is deliberately the smaller shape.
  author: { id: string; fullName: string } | null;
}
interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: (typeof PRIORITIES)[number];
  status: 'OPEN' | 'ESCALATED' | 'RESOLVED';
  submittedBy: UserRef;
  handledBy: UserRef | null;
  resolutionNote: string | null;
  escalationReason: string | null;
  createdAt: string;
  comments?: Comment[];
}

const PRIORITY_TONE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-rose-100 text-rose-700',
};

export default function TicketsPage() {
  const { user } = useSession('tenant');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canManage = !!user?.permissions?.includes('TICKET:MANAGE');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => apiFetch<Ticket[]>('/tickets'),
    enabled: !!user,
  });

  const createTicket = useMutation({
    mutationFn: (fd: FormData) =>
      apiFetch('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: fd.get('subject'),
          description: fd.get('description'),
          category: fd.get('category'),
          priority: fd.get('priority'),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setShowForm(false);
      setError(null);
      notifySuccess('Ticket submitted');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to submit ticket');
      notifyError(err, 'Failed to submit ticket');
    },
  });

  const table = useTableControls(tickets ?? [], { pageSize: 10, initialSortKey: 'createdAt' });

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy size={18} className="text-slate-400" />
              {canManage ? 'School tickets' : 'My tickets'}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {canManage
                ? 'Submitted by teachers, staff, and parents. Resolve directly, or escalate to the platform if it needs Super Admin attention.'
                : 'Raise an issue and track its status here. School Administration will respond.'}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ New ticket'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTicket.mutate(new FormData(e.currentTarget));
              }}
              className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
            >
              <Input name="subject" placeholder="Subject" required className="sm:col-span-2" />
              <textarea
                name="description"
                placeholder="Describe the issue..."
                required
                minLength={10}
                rows={3}
                className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <select name="category" required defaultValue="" className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                <option value="" disabled>
                  Category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <select name="priority" defaultValue="NORMAL" className="h-10 rounded-md border border-slate-300 px-3 text-sm">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? 'Submitting...' : 'Submit ticket'}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !tickets || tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets yet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {table.pageItems.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {t.subject}
                          {canManage && <span className="text-slate-500"> — {t.submittedBy.fullName}</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.category} · {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_TONE[t.priority]}`}>
                          {t.priority}
                        </span>
                        <Badge status={t.status} />
                      </div>
                    </button>
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

      {selectedId && <TicketDetail id={selectedId} canManage={canManage} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function TicketDetail({ id, canManage, onClose }: { id: string; canManage: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [showEscalate, setShowEscalate] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => apiFetch<Ticket>(`/tickets/${id}`),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  }

  const { typingUser, emitTyping } = useTicketSocket(
    id,
    (comment) =>
      queryClient.setQueryData<Ticket>(['ticket', id], (old) =>
        old && !old.comments?.some((c) => c.id === comment.id)
          ? { ...old, comments: [...(old.comments ?? []), comment] }
          : old,
      ),
    (status) => {
      // Platform-side actions (e.g. "assign to a Sub-Admin") broadcast platform-vocabulary statuses
      // into the same room — only apply ones that are meaningful in the tenant's own OPEN/ESCALATED/
      // RESOLVED vocabulary, so a school never sees an internal platform status like "ASSIGNED".
      if (status !== 'OPEN' && status !== 'ESCALATED' && status !== 'RESOLVED') return;
      queryClient.setQueryData<Ticket>(['ticket', id], (old) => (old ? { ...old, status } : old));
    },
  );

  // The gateway broadcasts a sent comment back to everyone in the room, including the sender — the
  // socket callback above already appends it, so this mutation only sends over REST and clears the
  // input; it deliberately does NOT invalidate/refetch (that would double the comment briefly).
  const addComment = useMutation({
    mutationFn: () => apiFetch(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify({ body: commentBody }) }),
    onSuccess: () => setCommentBody(''),
    onError: (err) => notifyError(err, 'Failed to add comment'),
  });

  const resolve = useMutation({
    mutationFn: () =>
      apiFetch(`/tickets/${id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolutionNote: resolutionNote || undefined }) }),
    onSuccess: () => {
      notifySuccess('Ticket resolved');
      invalidate();
    },
    onError: (err) => notifyError(err, 'Failed to resolve ticket'),
  });

  const escalate = useMutation({
    mutationFn: () => apiFetch(`/tickets/${id}/escalate`, { method: 'PATCH', body: JSON.stringify({ escalationReason }) }),
    onSuccess: () => {
      notifySuccess('Ticket escalated to the platform');
      setShowEscalate(false);
      invalidate();
    },
    onError: (err) => notifyError(err, 'Failed to escalate ticket'),
  });

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl animate-scale-in flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{ticket?.subject ?? 'Ticket'}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading || !ticket ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Badge status={ticket.status} />
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_TONE[ticket.priority]}`}>
                  {ticket.priority}
                </span>
                <span className="text-xs text-slate-500">{ticket.category}</span>
              </div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                From {ticket.submittedBy.fullName} · {new Date(ticket.createdAt).toLocaleString()}
              </p>
              <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>

              {ticket.escalationReason && (
                <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Escalated to the platform: {ticket.escalationReason}
                </p>
              )}
              {ticket.resolutionNote && (
                <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Resolved: {ticket.resolutionNote}
                </p>
              )}

              <p className="mb-2 text-xs font-medium uppercase text-slate-400">Conversation</p>
              <ul className="mb-4 flex flex-col gap-2">
                {(ticket.comments ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400">No replies yet.</p>
                ) : (
                  ticket.comments!.map((c) => (
                    <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="mb-1 text-xs font-medium text-slate-500">
                        {c.isPlatformReply ? c.platformAuthorName : c.author?.fullName} ·{' '}
                        {new Date(c.createdAt).toLocaleString()}
                      </p>
                      <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
                    </li>
                  ))
                )}
              </ul>

              {ticket.status !== 'RESOLVED' && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (commentBody.trim()) addComment.mutate();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={commentBody}
                      onChange={(e) => {
                        setCommentBody(e.target.value);
                        emitTyping();
                      }}
                      placeholder="Add a reply..."
                      className="flex-1"
                    />
                    <Button type="submit" size="sm" disabled={!commentBody.trim() || addComment.isPending}>
                      Reply
                    </Button>
                  </form>
                  <p className="mb-4 mt-1 h-4 text-xs italic text-slate-400">
                    {typingUser ? `${typingUser} is typing…` : ''}
                  </p>
                </>
              )}

              {canManage && ticket.status === 'OPEN' && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Resolution note (optional)"
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => resolve.mutate()} disabled={resolve.isPending}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowEscalate((v) => !v)}>
                      Escalate to Super Admin
                    </Button>
                  </div>
                  {showEscalate && (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={escalationReason}
                        onChange={(e) => setEscalationReason(e.target.value)}
                        placeholder="Why does this need platform attention?"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => escalationReason.trim().length >= 5 && escalate.mutate()}
                        disabled={escalationReason.trim().length < 5 || escalate.isPending}
                      >
                        Confirm escalate
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
