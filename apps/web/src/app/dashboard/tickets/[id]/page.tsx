'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PRIORITY_TONE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-rose-100 text-rose-700',
};

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  isPlatformReply: boolean;
  platformAuthorName: string | null;
  author: { id: string; fullName: string } | null;
}
interface TenantTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  submittedBy: { fullName: string; email: string };
  comments: Comment[];
}
interface Escalation {
  id: string;
  subject: string;
  category: string;
  priority: string;
  submitterName: string;
  escalationReason: string;
  status: 'PENDING' | 'ASSIGNED' | 'RESOLVED';
  resolutionNote: string | null;
  tenant: { id: string; name: string; slug: string };
  assignedTo: { id: string; fullName: string } | null;
  createdAt: string;
}
interface Admin {
  id: string;
  fullName: string;
  role: string;
  deletedAt: string | null;
}

export default function PlatformTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isSuperAdmin = getSessionUser()?.role === 'SUPER_ADMIN';
  const [comment, setComment] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-ticket', params.id],
    queryFn: () => apiFetch<{ escalation: Escalation; ticket: TenantTicket | null }>(`/platform/tickets/${params.id}`),
  });

  const adminsQuery = useQuery({
    queryKey: ['platform-admins'],
    queryFn: () => apiFetch<Admin[]>('/platform/admins'),
    enabled: isSuperAdmin,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['platform-ticket', params.id] });
    queryClient.invalidateQueries({ queryKey: ['platform-tickets'] });
  }

  const addComment = useMutation({
    mutationFn: () => apiFetch(`/platform/tickets/${params.id}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) }),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
    onError: (err) => notifyError(err, 'Failed to reply'),
  });

  const assign = useMutation({
    mutationFn: () => apiFetch(`/platform/tickets/${params.id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedToId: assignTo }) }),
    onSuccess: () => {
      notifySuccess('Ticket assigned');
      invalidate();
    },
    onError: (err) => notifyError(err, 'Failed to assign ticket'),
  });

  const resolve = useMutation({
    mutationFn: () =>
      apiFetch(`/platform/tickets/${params.id}/resolve`, { method: 'PATCH', body: JSON.stringify({ resolutionNote: resolutionNote || undefined }) }),
    onSuccess: () => {
      notifySuccess('Ticket resolved');
      invalidate();
    },
    onError: (err) => notifyError(err, 'Failed to resolve ticket'),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { escalation, ticket } = data;
  const subAdmins = (adminsQuery.data ?? []).filter((a) => a.role === 'SUB_ADMIN' && !a.deletedAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/tickets" className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} />
          Back to tickets
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{escalation.subject}</h1>
            <p className="text-sm text-slate-500">
              {escalation.tenant.name} · from {escalation.submitterName} · {new Date(escalation.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_TONE[escalation.priority]}`}>
              {escalation.priority}
            </span>
            <Badge status={escalation.status} />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escalation details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>
            <span className="font-medium text-slate-700">Category:</span> {escalation.category}
          </p>
          <p>
            <span className="font-medium text-slate-700">Why escalated:</span> {escalation.escalationReason}
          </p>
          {ticket && <p className="whitespace-pre-wrap text-slate-700">{ticket.description}</p>}
          {escalation.resolutionNote && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Resolved: {escalation.resolutionNote}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="mb-4 flex flex-col gap-2">
            {!ticket || ticket.comments.length === 0 ? (
              <p className="text-sm text-slate-400">No replies yet.</p>
            ) : (
              ticket.comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    {c.isPlatformReply ? c.platformAuthorName : c.author?.fullName} · {new Date(c.createdAt).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap text-slate-700">{c.body}</p>
                </li>
              ))
            )}
          </ul>

          {escalation.status !== 'RESOLVED' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) addComment.mutate();
              }}
              className="flex gap-2"
            >
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reply as Platform Support..." className="flex-1" />
              <Button type="submit" size="sm" disabled={!comment.trim() || addComment.isPending}>
                Reply
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {escalation.status !== 'RESOLVED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isSuperAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Assign to a Sub-Admin...</option>
                  {subAdmins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" disabled={!assignTo || assign.isPending} onClick={() => assign.mutate()}>
                  Assign
                </Button>
                {escalation.assignedTo && (
                  <span className="text-xs text-slate-500">Currently assigned to {escalation.assignedTo.fullName}</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Resolution note (optional)"
                className="flex-1"
              />
              <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
                Resolve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
